import { CallbackMap, MOS, MOSArr, MOS_CollectionId, MOS_CollectionUpdate, MOS_Filter, MOS_Move_Type, MOS_Protocol, MOS_Sort, PathInto, Sucket, TypeFromPath, deCapitalizeFirstLetter, thickLog } from '../CommonImports'

export type MOS_CollectionOptions<DocumentType> = {
    collectionId: MOS_CollectionId
    //     collectionPath: CollectionPath
    filter?: MOS_Filter<DocumentType>
    sort?: MOS_Sort<DocumentType>
}
export class MOS_Collection<DocType extends { _id: string }> {
    sucket: Sucket<MOS_Protocol<any>>;
    collectionId: MOS_CollectionId;

    private rawDocs: Map<string, DocType> = new Map()
    public static async Create<DocumentType extends { _id: string }>(options: MOS_CollectionOptions<DocumentType>, sucket: Sucket<MOS_Protocol<any>>): Promise<MOS_Collection<DocumentType>> {
        let out = new MOS_Collection<DocumentType>({
            collectionId: options.collectionId,
            filter: options.filter
        },
            sucket);
        await out.init(options);
        return out;
    }
    private constructor(options: MOS_CollectionOptions<DocType>, sucket: Sucket<MOS_Protocol<any>>) {
        this.sucket = sucket;
        this.collectionId = options.collectionId;
    }
    private async init(options: MOS_CollectionOptions<DocType>) {
        let list = await this.sucket.send('mosInitCollection', { collectionId: options.collectionId, filter: options.filter, sort: options.sort })
        if (list.type == 'Error') {
            throw new Error(list.message)
        }
        await this.addDocuments(list.documents)


    }
    private async addDocuments(docs: DocType[]) {
        for (let doc of docs) {
            // raw[doc._id] = doc;
            this.rawDocs.set(doc._id, doc);
        }

    }

    private getData<FieldPath extends PathInto<DocType>>(docIdAndFieldPath: `${string}.${FieldPath}`): TypeFromPath<DocType, FieldPath> | undefined {
        let pathParts = docIdAndFieldPath.split('.')
        if (!this.rawDocs.has(pathParts[0])) {
            return undefined;//throw new Error(`No document in ${this.collectionPath} with id ${pathParts[0]}`)
        }
        let doc = this.rawDocs.get(pathParts[0]) as any
        for (let i = 1; i < pathParts.length; i++) {
            if (i < pathParts.length - 1 && !doc[pathParts[i]]) {
                thickLog(`Couldn't get ${pathParts[i]} from ${pathParts.slice(1, i).join('.')}`, { color: 'Red', topic: 'DBS' })
                return undefined as any;
            }
            doc = doc[pathParts[i]]
        }
        return doc;
    }
    protected createMOS<OBJ extends { _id: string; }>(obj: OBJ, parentPath: string = ''): OBJ extends Array<infer subType> ? MOSArr<subType> : MOS<OBJ> {
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
            let dbsf = this.dbsFieldValue<OBJ>(fieldPath, obj[key]) as any
            if (typeof dbsf == 'object' || dbsf != MOS_Collection.GETFIELDTAG) {
                out[key] = dbsf as any
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
                            return (fromIndex: number, toIndex: number, moveType: MOS_Move_Type) => {
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
            }) as MOSArr<any>
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
    private dbsFieldValue<T extends {_id: string}>(fieldPath: string, value: T): (T extends Array<infer subType> ? MOSArr<subType> : MOS<T>) | null | string {
        if (value == null) {
            return null;
        }
        // if (Array.isArray(value)) {
        //     let ths = this;
        //     return value.map((item, index) => (ths.dbsFieldValue(`${fieldPath}.${index}`, item)))
        // }
        switch (typeof value) {
            case 'object':
                return this.createMOS<T>(value, fieldPath) as any
            default:
                return MOS_Collection.GETFIELDTAG;
        }
    }


    private changeLocks: Map<string, boolean> = new Map();
    private changeLockQue: Map<string, MOS_CollectionUpdate<DocType, any>> = new Map()
    async sendChangeRequest<FieldPath extends PathInto<DocType>>(docIdAndFieldPath: `${string}.${FieldPath}`, update: MOS_CollectionUpdate<DocType, FieldPath>) {
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
    protected async _sendChangeRequest<FieldPath extends PathInto<DocType>>(docId: string, fieldPath: string, update: MOS_CollectionUpdate<DocType, FieldPath>): Promise<void> {
        this.sucket.send('mosChange',{
            dbName: this.collectionId.dbName, 
            collectionName: this.collectionId.collectionName,
            docId: docId,
            update: update,
            fieldPath: fieldPath
        })
    }

    [Symbol.iterator](): Iterator<MOS<DocType>, any, undefined> {

        return {
            next: () => ({ value: null as any, done: false })
        }
    }

    private setSubscribers: CallbackMap<MOS<any>> = new CallbackMap();
    subscribeSet(path: string, callback: (fresh) => void) {
        thickLog(`MOS-Subscribing ${this.collectionId.dbName}.${this.collectionId.collectionName} to set ${path}`, { topic: 'MOS' })
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
}
MOS_Collection.prototype[Symbol.iterator] = function () {

} as any