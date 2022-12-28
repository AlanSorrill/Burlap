
import { CallbackMap, DBObject, DBS, DBS_Array, DBS_CollectionPath, DBS_CollectionUpdate, DBS_Filter, DBS_Move_Type, SVET_Packet, DBS_Sort, deCapitalizeFirstLetter, PathInto, SEVT_DBS_CollectionUpdate, thickLog, TypeFromPath, DBS_CollectionPath_GetType } from "../CommonImports";

// export type DBSConsumer = {
//     [Prop in keyof DBS_CollectionTypes_WorkspaceDb as Uncapitalize<Prop>]: DBS_Reciever_Collection<DBS_CollectionTypes_WorkspaceDb[Prop]>
// } & {
//         [Prop in keyof DBS_CollectionTypes_DoppioDb as Uncapitalize<Prop>]: DBS_Reciever_Collection<DBS_CollectionTypes_DoppioDb[Prop]>
//     }

export type DBS_Client_Collection_Options<dbObject extends DBObject & { _id: string }> = {
    items?: dbObject[]
    filter?: DBS_Filter<dbObject>,
    sort?: DBS_Sort<dbObject>
}
export abstract class DBS_Reciever_Collection<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> {

    collectionPath: CollectionPath;
    protected constructor(collectionPath: CollectionPath) {
        this.collectionPath = collectionPath;
    }

    protected async init(options: DBS_Client_Collection_Options<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>) {
        let ths = this;
        await this.onInit(options)
        if (options.items) {
            this.addDocumentDbs((options.items as any).map(doc => {
                ths.itemData.set(doc._id, doc)
                return ths.createDbs(doc, doc._id) as any;
            }) as DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>[])
        } else {
            let documents = await this.aquireAllDocuments(this.collectionPath, options.filter, options.sort)
            let ths = this;
            this.addDocumentDbs((documents as any[]).map(doc => {
                ths.itemData.set(doc._id, doc)
                return ths.createDbs(doc, doc._id) as any;
            }));
        }

    }
    protected abstract onInit(options: DBS_Client_Collection_Options<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>): Promise<void>

    protected abstract aquireAllDocuments(collectionPath: CollectionPath, filter?: DBS_Filter<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>, sort?: DBS_Sort<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>): Promise<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>[]>


    async setFilter(filter: DBS_Filter<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>) {
        let documents = await this.aquireAllDocuments(this.collectionPath, filter)//let resp = await client.webPortalSocket.sendMessage<MSG_DBS_CollectionListResponse<dbObject>>({ type: 'dbsCollectionListRequest', collectionPath: this.collectionPath, filter: filter }, true);

        let docMap: Map<string, DBS_CollectionPath_GetType<DBS_Types, CollectionPath>> = new Map()
        for (let d of documents) {
            docMap.set(d._id, d);
        }
        let ths = this;
        let removeCount = 0;

        this.itemDbs.forEach((doc) => {
            if (!docMap.has(doc._id)) {
                removeCount++;
                ths.itemData.delete(doc._id)
                ths.itemDbs.delete(doc._id)
            }
        })
        if (removeCount > 0) {
            ths.goodDbsList = false;
        }
        // this.itemList.removeInPlace((doc) => {
        //     if (docMap.has(doc._id)) {
        //         docMap.delete(doc._id)
        //         return true;
        //     }
        //     removeCount++;
        //     ths.itemData.delete(doc._id)
        //     return false;
        // })
        for (let newDoc of docMap.values()) {
            this.itemData.set(newDoc._id, newDoc)
            this.addDocumentDbs(ths.createDbs(newDoc, newDoc._id) as any)
        }
        if (docMap.size > 0 || removeCount > 0) {
            this.notifyListChanged();
        }
    }
    protected async recieveUpdate(evt: SVET_Packet<SEVT_DBS_CollectionUpdate<DBS_Types, CollectionPath>>) {//MSG_DBS_CollectionUpdateEvt<dbObject>) {
        switch (evt.op) {
            case 'insert':
                this.itemData.set(evt.document._id, evt.document)
                let fresh = this.createDbs(evt.document, evt.document._id) as any
                this.addDocumentDbs(fresh)
                this.notifyListChanged();
                this.insertWaiters.notify(evt.document._id, fresh)
                break;
            case 'remove':
                this.removeDocumentDbs(evt.documentId);
                this.itemData.delete(evt.documentId)
                this.notifyListChanged();
                break;
            case 'update':
                for (let field of Object.keys(evt.updatedFields)) {
                    let fieldName = field.split('.').last;
                    let parentData = this.getParentDataOfField(`${evt.documentId}.${field}` as any)
                    let parentDbs = this.getParentDbsOfField(`${evt.documentId}.${field}` as any)
                    if (!parentData) {
                        thickLog(`Couldnt find data ${evt.documentId}.${field}`, { color: 'Red' });
                        return;
                    }
                    if (!parentDbs) {
                        thickLog(`Couldnt find dbs ${evt.documentId}.${field}`, { color: 'Red' });
                        return;
                    }
                    if (Array.isArray(parentData[fieldName])) { }
                    parentData[fieldName] = evt.updatedFields[field]
                    if (typeof parentData[fieldName] == 'object') {
                        parentDbs[fieldName] = this.createDbs(parentData[fieldName], `${evt.documentId}.${field}`)
                    }
                    this.setSubscribers.notify(`${evt.documentId}.${field}`, parentDbs[fieldName])
                    // this.setSubs.get(field)?.forEach(([id, callback]) => {
                    //     callback(parentData[fieldName])
                    // })
                    if (Array.isArray(parentData[fieldName])) {
                        this.setSubscribers.notify(`${evt.documentId}.${field}.*`)
                        // this.setSubs.get(`${field}.~ItemSet~`)?.forEach(([id, callback]) => {
                        //     (callback as any)();//nasty hack
                        // })
                    }
                }
        }
    }
    private changeLocks: Map<string, boolean> = new Map();
    private changeLockQue: Map<string, DBS_CollectionUpdate<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, any>> = new Map()
    async sendChangeRequest<FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>(docIdAndFieldPath: `${string}.${FieldPath}`, update: DBS_CollectionUpdate<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, FieldPath>) {
        if (this.changeLocks.get(docIdAndFieldPath)) {
            thickLog(`Que update ${docIdAndFieldPath}`)
            this.changeLockQue.set(docIdAndFieldPath, update);
            return;
        }
        let pathParts = docIdAndFieldPath.split('.')
        let docId = pathParts.shift() as string
        let fieldPath = pathParts.join('.') as FieldPath




        this.changeLocks.set(docIdAndFieldPath, true);

        let resp = await this._sendChangeRequest(docId, fieldPath, update as any);

        this.changeLocks.set(docIdAndFieldPath, false)
        thickLog(`Clearing changelock ${docIdAndFieldPath}`)
        if (this.changeLockQue.has(docIdAndFieldPath)) {
            thickLog(`change request from que`)
            let update = this.changeLockQue.get(docIdAndFieldPath)
            this.changeLockQue.delete(docIdAndFieldPath)
            return this.sendChangeRequest(docIdAndFieldPath as any, update as any);
        }
    }
    protected abstract _sendChangeRequest<FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>(docId: string, fieldPath: string, update: DBS_CollectionUpdate<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, FieldPath>): Promise<void>
    // itemList: Array<DBS<dbObject>> = []

    protected addDocumentDbs(doc: DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>> | DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>[]) {
        if (Array.isArray(doc)) {
            for (let i = 0; i < doc.length; i++) {
                this.addDocumentDbs(doc[i])
            }
            return;
        }
        if (!doc._id) {
            throw new Error(`Can't add doc with no id`)
        }
        this.itemDbs.set(doc._id, doc);
        this.goodDbsList = false;
    }
    private removeDocumentDbs(id: string) {
        if (this.itemDbs.has(id)) {
            this.itemDbs.delete(id);
            this.goodDbsList = false;
        }
    }
    protected _itemDbsList: DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>[]
    protected goodDbsList = false;
    protected itemDbs: Map<string, DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>> = new Map()
    protected itemData: Map<string, DBS_CollectionPath_GetType<DBS_Types, CollectionPath>> = new Map();
    get itemList(): DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>[] {
        if (this.goodDbsList) {
            return this._itemDbsList
        }
        this._itemDbsList = [];
        this.itemDbs.forEach((dbs) => {
            this._itemDbsList.push(dbs);
        })
        this.goodDbsList = true;
        return this._itemDbsList
    }
    getDocument(id: string) {
        return this.itemDbs.get(id)
    }
    protected insertWaiters: CallbackMap<DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>> = new CallbackMap()
    protected abstract _insertDocument(freshDoc: Omit<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, '_id'> & { _id?: string }): Promise<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>
    async insertDocument(freshDoc: Omit<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, '_id'> & { _id?: string }): Promise<DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>> {
        let ths = this;


        let document = await this._insertDocument(freshDoc);

        if (this.itemData.has(document._id)) {
            return this.getDocument(document._id) as DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>
        }
        return new Promise((acc) => {
            if (ths.itemData.has(document._id)) {
                return ths.getDocument(document._id) as DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>
            }
            let cancel = this.insertWaiters.addCallback(document._id, ((freshItem: DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>) => {
                acc(freshItem as any)
                cancel();
            }) as any)
        })

        // this.itemData.set(resp.document._id, resp.document)
        // let freshDbs = this.createDbs(resp.document, resp.document._id)
        // this.itemList.push(freshDbs as DBS<dbObject>)
        // this.notifyListChanged();
        // return freshDbs
    }
    protected abstract _deleteDocument(_id: string): Promise<boolean>
    async deleteDocument(_id: string) {
        thickLog(`Delete document ${_id} from ${this.collectionPath}`)

        if (await this._deleteDocument(_id)) {
            this.itemData.delete(_id)
        }
        // this.itemList.removeInPlace((item) => (item._id != _id))
        this.notifyListChanged();

    }

    private getData<FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>(docIdAndFieldPath: `${string}.${FieldPath}`): TypeFromPath<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, FieldPath> | undefined {
        let pathParts = docIdAndFieldPath.split('.')
        if (!this.itemData.has(pathParts[0])) {
            return undefined;//throw new Error(`No document in ${this.collectionPath} with id ${pathParts[0]}`)
        }
        let doc = this.itemData.get(pathParts[0]) as any
        for (let i = 1; i < pathParts.length; i++) {
            if (i < pathParts.length - 1 && !doc[pathParts[i]]) {
                thickLog(`Couldn't get ${pathParts[i]} from ${pathParts.slice(1, i).join('.')}`, { color: 'Red', topic: 'DBS' })
                return undefined as any;
            }
            doc = doc[pathParts[i]]
        }
        return doc;
    }
    private getParentDbsOfField<FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>(docIdAndFieldPath: `${string}.${FieldPath}`): TypeFromPath<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, FieldPath> | undefined {
        let pathParts = docIdAndFieldPath.split('.')
        if (!this.itemDbs.has(pathParts[0])) {
            thickLog(`No document in ${this.collectionPath} with id ${pathParts[0]}`, { color: 'Red' })
            return undefined;
        }
        let doc = this.itemDbs.get(pathParts[0]) as any
        for (let i = 1; i < pathParts.length - 1; i++) {
            if (i < pathParts.length - 1 && !doc[pathParts[i]]) {
                thickLog(`Couldn't get ${pathParts[i]} from ${pathParts.slice(1, i).join('.')}`, { color: 'Red', topic: 'DBS' })
                return undefined as any;
            }
            doc = doc[pathParts[i]]
        }
        return doc;
    }
    private getParentDataOfField<FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>(docIdAndFieldPath: `${string}.${FieldPath}`): TypeFromPath<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, FieldPath> | undefined {
        let pathParts = docIdAndFieldPath.split('.')
        if (!this.itemData.has(pathParts[0])) {
            thickLog(`No document in ${this.collectionPath} with id ${pathParts[0]}`, { color: 'Red' })
            return undefined;
        }
        let doc = this.itemData.get(pathParts[0]) as any
        for (let i = 1; i < pathParts.length - 1; i++) {
            if (i < pathParts.length - 1 && !doc[pathParts[i]]) {
                thickLog(`Couldn't get ${pathParts[i]} from ${pathParts.slice(1, i).join('.')}`, { color: 'Red', topic: 'DBS' })
                return undefined as any;
            }
            doc = doc[pathParts[i]]
        }
        return doc;
    }
    // private setSubCounter = 0
    // private setSubs: Map<string, Array<[id: number, callback: (fresh) => void]>> = new Map()
    private setSubscribers: CallbackMap<DBS<any>> = new CallbackMap();
    subscribeSet(path: string, callback: (fresh) => void) {
        thickLog(`DBS-Subscribing ${this.collectionPath} to set ${path}`, { topic: 'DBS' })
        return this.setSubscribers.addCallback(path, callback)
        // let id = this.setSubCounter++;
        // if (this.setSubs.has(path)) {
        //     this.setSubs.get(path)?.push([id, callback])
        // } else {
        //     this.setSubs.set(path, [[id, callback]])
        // }
        // let ths = this;
        // return () => {
        //     ths.setSubs.get(path)?.removeInPlace(([idd, callback]) => (idd != id))
        // }
    }

    protected createDbs<OBJ extends {}>(obj: OBJ, parentPath: string = ''): OBJ extends Array<infer subType> ? DBS_Array<subType> : DBS<OBJ> {
        if (!obj) {
            return obj as any;
        }
        let out = Array.isArray(obj) ? [] : {} as any;
        let ths = this;

        for (let key of Object.keys(obj)) {
            if (key == '_id') {
                out[key] = obj[key]
            }
            let fieldPath = `${parentPath}.${key}`
            let dbsf = this.dbsFieldValue(fieldPath, obj[key])
            if (typeof dbsf == 'object' || dbsf != DBS_Reciever_Collection.GETFIELDTAG) {
                out[key] = dbsf
            }
            // if (key != '_id') {
            //     out[`set${capitalizeFirstLetter(key)}`] = (freshValue) => {
            //         ths.sendChangeRequest(fieldPath as any, { op: 'set', value: freshValue } as any)
            //     }
            //     out[`on${capitalizeFirstLetter(key)}Set`] = (callback: (fresh) => void) => {
            //         return ths.subscribeSet(fieldPath, callback)
            //     }
            // }
        }

        if (Array.isArray(obj)) {
            let outDbs = new Proxy(out, {
                get(target, p) {
                    let overrides = ['length', 'map', 'push', 'find', 'findIndex']
                    if (typeof p == 'symbol' || (typeof target[p] != 'undefined' && !overrides.includes(p))) {
                        return target[p]
                    }
                    switch (p) {
                        case 'onThisSet':
                            return (callback: (fresh) => void) => {
                                return ths.subscribeSet(parentPath, callback)
                            }
                        case 'onItemSet':
                            return (callback: () => void) => {
                                return ths.subscribeSet(`${parentPath}.*`, callback)
                            }
                        case 'moveItem':
                            return (fromIndex: number, toIndex: number, moveType: DBS_Move_Type) => {
                                return ths.sendChangeRequest(parentPath as any, { op: 'move', fromIndex: fromIndex, toIndex: toIndex, moveType: moveType } as any)
                            }
                        case 'setThis':
                            return (freshValue) => {
                                return ths.sendChangeRequest(parentPath as any, { op: 'set', value: freshValue } as any)
                            }
                        case 'push':
                            return (freshItem) => {
                                return ths.sendChangeRequest(parentPath as any, { op: 'push', value: freshItem } as any)
                            }
                        case 'solidify':
                            return () => {
                                return ths.getData(parentPath as any) as any
                            }
                        case 'getKeys':
                            return () => {
                                return Object.keys(ths.getData(parentPath as any) as Object)
                            }
                        case 'length':
                            return ths.getData(parentPath as any)?.['length']
                        case 'map':
                            return <T>(callback: (value, index, arr) => T) => {
                                let o: T[] = []
                                for (let i = 0; i < outDbs.length; i++) {
                                    thickLog(`--MAPPING ${i}: ${outDbs[i]?.['solidify'] ? JSON.stringify(outDbs[i].solidify()) : JSON.stringify(outDbs[i])}`)
                                    o.push(callback(outDbs[i], i, outDbs))
                                }
                                return o;
                            }
                        case 'remove':

                            return (indexOrPredicate: number | ((item: any, index: number, arr: Array<any>) => boolean)) => {
                                if (typeof indexOrPredicate == 'number') {
                                    ths.sendChangeRequest(parentPath as any, { op: 'remove', index: indexOrPredicate } as any)
                                    return;
                                }
                                let data = ths.getData(parentPath as any) as Array<any>
                                let index = data.findIndex(indexOrPredicate)
                                if (index == -1) {
                                    throw new Error(`Can't delete because predicate found nothing`)
                                }
                                ths.sendChangeRequest(parentPath as any, { op: 'remove', index: index } as any)
                            }
                        case 'includes':
                            return (item: any) => {
                                let data = ths.getData(parentPath as any) as Array<any>
                                return data.includes(item);
                            }
                        case 'find':
                            return (predicate: (item: any, index: number, arr: any[]) => boolean) => {
                                let data = ths.getData(parentPath as any) as Array<any>
                                return data.find(predicate)
                            }
                        case 'findIndex':
                            return (predicate: (item: any, index: number, arr: any[]) => boolean) => {
                                let data = ths.getData(parentPath as any) as Array<any>
                                return data.findIndex(predicate)
                            }
                        case '_path':
                            return parentPath
                    }

                    let fieldPath = `${parentPath}.${p}` as any;
                    return ths.getData(fieldPath)
                }
            }) as DBS_Array<any>
            return outDbs as any
        } else {
            return new Proxy(out, {
                get(target, p) {
                    if (typeof target[p] == 'object' || typeof p == 'symbol' || typeof target[p] == 'function' || p == '_id') {
                        return target[p]
                    }
                    if (p.endsWith('GetDbsPath')) {
                        return () => (`${parentPath}.${p}`)
                    }
                    if (p.startsWith('is') && p.endsWith('Valid')) {
                        let fieldName = deCapitalizeFirstLetter(p.substring(2, p.length - 5))

                    }

                    switch (p) {
                        case 'setThis':
                            return (freshValue) => {
                                ths.sendChangeRequest(parentPath as any, { op: 'set', value: freshValue } as any)
                            }
                        case 'onThisSet':
                            return (callback: (fresh) => void) => {
                                return ths.subscribeSet(parentPath, callback)
                            }
                        case 'onChildSet':
                            return (callback: () => void) => {
                                return ths.subscribeSet(`${parentPath}.*`, callback as any)
                            }
                        case 'solidify':
                            return () => {
                                return ths.getData(parentPath as any) as any
                            }
                        case '_path':
                            return parentPath
                    }
                    if (p.startsWith('on') && p.endsWith('Set')) {
                        let field = deCapitalizeFirstLetter(p.substring(2, p.length - 3))
                        return (callback: (fresh) => void) => {
                            return ths.subscribeSet(`${parentPath}.${field}` as any, callback)
                        }
                    } else if (p.startsWith('set')) {
                        let field = deCapitalizeFirstLetter(p.substring(3));
                        return (freshValue) => {
                            return ths.sendChangeRequest(`${parentPath}.${field}` as any, { op: 'set', value: freshValue } as any)
                        }
                    }

                    let fieldPath = `${parentPath}.${p}` as any;
                    return ths.getData(fieldPath)
                },
                set(target, p, newValue) {

                    target[p] = newValue;
                    return true;

                    // let setr = target[`set${capitalizeFirstLetter(p)}`]
                    // if (typeof setr == 'function') {
                    //     setr(newValue)
                    //     return true;
                    // } else {
                    //     return false;
                    // }
                },
            });
        }

    }
    private static GETFIELDTAG = '~GETFIELD~'
    private dbsFieldValue<T>(fieldPath: string, value: T) {
        if (value == null) {
            return null;
        }
        // if (Array.isArray(value)) {
        //     let ths = this;
        //     return value.map((item, index) => (ths.dbsFieldValue(`${fieldPath}.${index}`, item)))
        // }
        switch (typeof value) {
            case 'object':
                return this.createDbs(value, fieldPath)
            default:
                return DBS_Reciever_Collection.GETFIELDTAG;
        }
    }

    private notifyListChanged() {
        for (let callback of this.listChangeSubs.values()) {
            callback(this.itemList)
        }
    }
    private listChangeCounter = 0
    private listChangeSubs: Map<number, (items: DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>[]) => void> = new Map()
    onListChange(callback: (items: DBS<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>[]) => void): (() => void) {
        thickLog(`DBS-Subscribing ${this.collectionPath} to listChange`, { topic: 'DBS' })
        let id = this.listChangeCounter++;

        this.listChangeSubs.set(id, callback)

        let ths = this;
        return () => {
            ths.listChangeSubs.delete(id)
        }
    }

}
// export type DBS_CollectionGetter = <CollectionPath extends DBS_CollectionPath_DOPIO>(path: CollectionPath) => Promise<DBS_Reciever_Collection<DBS_CollectionType<CollectionPath>>>
