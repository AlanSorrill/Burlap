
import { DBS_CollectionUpdate, Sucket, SVET_Packet, DBS, DBS_Client_Collection_Options, DBS_CollectionPath, DBS_Reciever_Collection, DBS_Filter, DBS_Sort, PathInto, SEVT_DBS_CollectionUpdate, MSG_DBS_CollectionUpdateRequest, DBS_CollectionPath_GetType, DBS_Protocol, ClientSucket, } from '../ClientImports'

export class DBS_Client_Collection<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> extends DBS_Reciever_Collection<DBS_Types, CollectionPath> {
    protected async _sendChangeRequest<FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>(docId: string, fieldPath: string, update: DBS_CollectionUpdate<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, FieldPath>): Promise<void> {
        await this.sucket.send('dbsChange', { collectionPath: this.collectionPath, docId: docId, fieldPath: fieldPath, update: update } as any)
    }
    sucket: ClientSucket<DBS_Protocol<DBS_Types>>;
    constructor(collectionPath: CollectionPath, sucket: ClientSucket<any>) {
        super(collectionPath)
        this.sucket = sucket as any;
    }
    protected async _deleteDocument(_id: string): Promise<boolean> {
        let resp = await this.sucket.send('dbsCollectionDelete', { documentId: _id, collectionPath: this.collectionPath })
        switch (resp.type) {
            case 'Error':
                throw new Error(resp.message);
            case 'dbsCollectionDeleteResp':
                return resp.success
        }
        return false;
    }
    protected async _insertDocument(freshDoc: Omit<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, '_id'> & { _id?: string | undefined; }): Promise<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>> {
        let response = await this.sucket.send('dbsCollectionInsert', { document: freshDoc, collectionPath: this.collectionPath })
        switch (response.type) {
            case 'Error':
                throw new Error(response.message);
            case 'dbsCollectionInsertResp':
                return response.document as DBS_CollectionPath_GetType<DBS_Types, CollectionPath>
        }
    }
    // protected async _sendChangeRequest<FieldPath extends PathInto<dbObject>>(docId: string, fieldPath: FieldPath, update: DBS_CollectionUpdate<dbObject, FieldPath>): Promise<void> {
    // }
    protected async aquireAllDocuments(collectionPath: CollectionPath, filter?: DBS_Filter<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>> | undefined, sort?: DBS_Sort<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>> | undefined): Promise<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>[]> {
        let resp = await this.sucket.send('dbsCollectionList', { collectionPath: this.collectionPath, filter: filter, sort: sort });
        switch (resp.type) {
            case 'Error':
                throw new Error(resp.message)
            case 'dbsCollectionListResp':
                return resp.documents as DBS_CollectionPath_GetType<DBS_Types, CollectionPath>[]
        }
    }
    protected async onInit(options: DBS_Client_Collection_Options<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>): Promise<void> {
        let ths = this;

        this.sucket.on('dbsCollectionUpdate', { collectionPath: this.collectionPath }, (packet) => {

            ths.recieveUpdate(packet as SVET_Packet<SEVT_DBS_CollectionUpdate<DBS_Types, CollectionPath>>);
        })
        // this.sucket.subscribeTo(`dbs|${this.collectionPath}`, (evt: MSG_PackageOf<MSG_DBS_CollectionUpdateEvt<dbObject>>) => {

        // })
    }
    static async Create<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>>(sucket: ClientSucket<any>, collectionPath: CollectionPath, options: DBS_Client_Collection_Options<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>): Promise<DBS_Reciever_Collection<DBS_Types, CollectionPath>> {
        let out = new DBS_Client_Collection<DBS_Types, CollectionPath>(collectionPath, sucket)
        await out.init(options);
        return out
    }



    // async insertDocument(freshDoc: Omit<dbObject, '_id'> & { _id?: string }): Promise<DBS<dbObject>> {
    //     let ths = this;

    //     let response = await this.sucket.sendMessage<MSG_DBS_CollectionInsertResponse<dbObject>>({ type: 'dbsCollectionInsertRequest', document: freshDoc, collectionPath: this.collectionPath })
    //     if (isMSGError(response)) {
    //         throw new Error(response.message)
    //     }
    //     let document = response.document;

    //     if (this.itemData.has(document._id)) {
    //         return this.getDocument(document._id) as DBS<dbObject>
    //     }
    //     return new Promise((acc) => {
    //         if (ths.itemData.has(document._id)) {
    //             return ths.getDocument(document._id) as DBS<dbObject>
    //         }
    //         let cancel = this.insertWaiters.addCallback((response as MSG_DBS_CollectionInsertResponse<dbObject>).document._id, ((freshItem: DBS<dbObject>) => {
    //             acc(freshItem)
    //             cancel();
    //         }) as any)
    //     })

    //     // this.itemData.set(resp.document._id, resp.document)
    //     // let freshDbs = this.createDbs(resp.document, resp.document._id)
    //     // this.itemList.push(freshDbs as DBS<dbObject>)
    //     // this.notifyListChanged();
    //     // return freshDbs
    // }

}