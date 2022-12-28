
import { Document, Collection, WithId, MongoClient, ChangeStreamDocument, ObjectId } from "mongodb";
import { Burlap, Protocol_GetRespObj, Protocol_GetState, SucketProtocol ,  ChangeStreamEventifier,  ContainsCharacter, dbsPermissionToInt, DBS_CollectionPath, DBS_CollectionPath_GetType, DBS_CollectionPermissionPredicates, DBS_Condition, DBS_Filter, DBS_Permission, DBS_PermissionPredicates, DBS_Protocol, DBS_Sort, getFromPath, getWildcardField, matchesWildcard, MatchWildcardFieldNames, mongoIdToString, MSG_DBS_CollectionListRequest, MSG_DBS_CollectionUpdateRequest, PathFlatten, PathFlattenObj, PathInto, SEVT_DBS_CollectionUpdate, StringifyWildcards, thickLog, TypeFromPath } from "../ServerImports";


// export type MatchesWildcard<Str extends string, Wild extends string> = Str extends StringifyWildcards<>
// let flatPath:  = 'DoppioDb.Users'
export type MongoCollectionGetter<DBS_Types extends {}, Domain extends (keyof DBS_Types) & string, CollectName extends (keyof DBS_Types[Domain])> = ContainsCharacter<Domain, '*'> extends true ? (domain: Domain, subDomain: StringifyWildcards<Domain>, collectionName: CollectName) => Collection<DBS_Types[Domain][CollectName] & Document> : (domain: Domain, collectionName: CollectName) => Collection<DBS_Types[Domain][CollectName] & Document>

export type DBS_ServerHandler_Options<DBS_Types extends {}, Protocol extends SucketProtocol> = {
    permissions: DBS_PermissionPredicates<DBS_Types, Protocol>

}
export class DBSServerHandler<DBS_Types extends {}, Protocol extends SucketProtocol> {
    burlap: Burlap<Protocol | DBS_Protocol<DBS_Types>>
    options: DBS_ServerHandler_Options<DBS_Types, Protocol>
    mongoClient: MongoClient;
    // getMongoCollection<DBName extends (Exclude<keyof DBS_Types,'*'>) | `${string}`>(dbName: DBName): DBName extends `WS_${infer id}` ? DBS_Types['*'] : DBName extends (keyof DBS_Types) ? DBS_Types[DBName] : 'bad' {
    //     return null as any;
    // }
    private eventifiers: Map<DBS_CollectionPath<DBS_Types>, CollectionStreamWatcher<DBS_Types, DBS_CollectionPath<DBS_Types>>>

    async getPermission<CollectionPath extends DBS_CollectionPath<DBS_Types>>(collectionPath: CollectionPath & string, targetObj: DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, state: Protocol_GetState<Protocol>) {
        if (typeof collectionPath != 'string') {
            throw new Error(`Can't use collection path ${JSON.stringify(collectionPath)}`)
        }
        let parts = (collectionPath as string).split('.')
        if (parts.length != 2) {
            throw new Error(`Bad collection path ${collectionPath}`)
        }
        let dir = getWildcardField(parts[0], this.options.permissions) as { [k: string]: (targetObj: DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, state: Protocol_GetState<Protocol>, dbName: string) => DBS_Permission | Promise<DBS_Permission> } //(targetObj: DBS_Collection_Types[P], state: Protocol_GetState<Protocol>, dbName: string) => DBS_Permission | Promise<DBS_Permission>
        let predicate = dir[parts[1]];
        if (typeof predicate != 'function') {
            throw new Error(`Can't find predicate for ${parts[1]} in ${parts[0]}`)
        }
        return predicate(targetObj, state, parts[0]);
    }

    async filterByPermission<CollectionPath extends DBS_CollectionPath<DBS_Types>>(perm: DBS_Permission, collectionPath: CollectionPath & string, targetObj: DBS_CollectionPath_GetType<DBS_Types, CollectionPath>[], state: Protocol_GetState<Protocol>) {
        if (perm == 'none') {
            return targetObj;
        }
        let targetPerm = dbsPermissionToInt(perm);
        let out: DBS_CollectionPath_GetType<DBS_Types, CollectionPath>[] = []
        for (let obj of targetObj) {
            let docPerm = dbsPermissionToInt(await this.getPermission(collectionPath, obj, state));
            if (docPerm >= targetPerm) {
                out.push(obj);
            }
        }
        return out;
    }

    getCollection<CollectionPath extends DBS_CollectionPath<DBS_Types> & string>(collectionPath: CollectionPath): Collection<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & {}> {
        if (typeof collectionPath != 'string') {
            throw new Error(`Can't use collection path ${JSON.stringify(collectionPath)}`)
        }
        let parts = (collectionPath as string).split('.')
        if (parts.length != 2) {
            throw new Error(`Bad collection path ${collectionPath}`)
        }
        let db = this.mongoClient.db(parts[0])
        return db.collection(parts[1])
    }

    constructor(options: DBS_ServerHandler_Options<DBS_Types, Protocol>, burlap: Burlap<Protocol>, mongoClient: MongoClient) {
        this.options = options;
        this.mongoClient = mongoClient
        let ths = this;
        burlap.addProtocol<DBS_Protocol<DBS_Types>>({
            eventPredicates: {
                dbsCollectionUpdate: (reg, packet) => (true)
            },
            reqRespListeners: {
                async onDbsCollectionList(msg, state) {
                    let collection = ths.getCollection(msg.collectionPath)
                    if (!collection) {
                        return { type: 'Error', message: `No collection ${msg.collectionPath}` }
                    }
                    let found = await collection.find((typeof msg.filter != 'undefined' ? msg.filter : {}) as any).sort((typeof msg.sort != 'undefined' ? msg.sort : {}) as any).toArray();

                    let result = await ths.filterByPermission('read', msg.collectionPath, found as any, state as any);

                    return { type: 'dbsCollectionListResp', documents: result } as any
                },
                async onDbsCollectionInsert(msg, state) {
                    let perm = await ths.getPermission(msg.collectionPath, msg.document as any, state as any)
                    if (perm != 'write') {
                        return { type: 'Error', message: `Bad permission ${perm} for ${msg.collectionPath}` }
                    }
                    let collection = ths.getCollection(msg.collectionPath)
                    if (!collection) {
                        return { type: 'Error', message: `No collection ${msg.collectionPath}` }
                    }
                    let result = await collection.insertOne(msg.document as any);
                    if (!result.acknowledged) {
                        return { type: `Error`, message: `Failed to insert ${JSON.stringify(msg.document)} in ${msg.collectionPath}` }
                    }
                    msg.document._id = mongoIdToString(result.insertedId);
                    return { type: 'dbsCollectionInsertResp', document: msg.document } as any;
                },
                async onDbsCollectionDelete(msg, state) {
                    let collection = ths.getCollection(msg.collectionPath)
                    if (!collection) {
                        return { type: 'Error', message: `No collection ${msg.collectionPath}` }
                    }
                    let doc = await collection.findOne({ _id: { $eq: msg.documentId } } as any)
                    if (!doc) {
                        return { type: `Error`, message: `Document not found: ${msg.documentId} in ${msg.collectionPath}` }
                    }
                    let perm = await ths.getPermission(msg.collectionPath, doc as any, state as any);
                    if (perm != 'write') {
                        return { type: `Error`, message: `Can't delete ${msg.collectionPath} ${msg.documentId} with ${perm} permission` }
                    }
                    let result = await collection.deleteOne({ _id: { $eq: msg.documentId } } as any)

                    return { type: 'dbsCollectionDeleteResp', success: result.acknowledged }
                },
                async onDbsChange(msg, state) {
                    if (msg.type != 'dbsChangeReq') {
                        throw new Error(`Not expecting responses ${msg.type}`)
                    }
                    let collection = this.getCollection(msg.collectionPath);
                    let ths = this;
                    switch (msg.update.op) {
                        case 'move':
                            try {
                                let old = await (collection as Collection<any>).findOne({ _id: { $eq: msg.docId } })

                                let oldArr = (getFromPath(old, msg.update.fieldPath)) as Array<any> | undefined
                                if (oldArr) {
                                    if (msg.update.fromIndex < 0 || msg.update.fromIndex >= oldArr.length) {
                                        thickLog(`Can't move item from index ${msg.update.fromIndex} > old length ${oldArr.length}`, { color: 'Red' })
                                        return { type: 'Error', message: `Can't move item from index ${msg.update.fromIndex} > old length ${oldArr.length}` };
                                    }
                                    if (msg.update.toIndex < 0 || msg.update.toIndex >= oldArr.length) {
                                        thickLog(`Can't move item to index ${msg.update.fromIndex} > old length ${oldArr.length}`, { color: 'Red' })
                                        return { type: 'Error', message: `Can't move item to index ${msg.update.fromIndex} > old length ${oldArr.length}` };
                                    }

                                    switch (msg.update.moveType) {
                                        case 'SwitchIndicies':
                                            let tmp = oldArr[msg.update.toIndex]
                                            oldArr[msg.update.toIndex] = oldArr[msg.update.fromIndex]
                                            oldArr[msg.update.fromIndex] = tmp;
                                            break;
                                        case 'moveFromShiftOthers':
                                            let temp = oldArr[msg.update.fromIndex]
                                            let withoutFrom = oldArr.slice(0, msg.update.fromIndex).concat(oldArr.slice(msg.update.fromIndex + 1))
                                            oldArr = withoutFrom.slice(0, msg.update.toIndex).concat([temp], withoutFrom.slice(msg.update.toIndex))
                                            break;
                                    }
                                }
                                let pushUpdate = {} as any
                                pushUpdate[msg.update.fieldPath] = oldArr
                                await new Promise<void>(async (acc) => {
                                    let hasCompleted = false;
                                    (collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $set: pushUpdate }, { upsert: true }).then((result) => {
                                        if (!hasCompleted && result.modifiedCount == 0) {
                                            hasCompleted = true;
                                            acc();
                                        }
                                    })
                                    this.awaitFieldUpdate(msg.collectionPath, msg.docId, `${msg.update.fieldPath}.*`).then(() => {
                                        if (!hasCompleted) {
                                            hasCompleted = true;
                                            acc();
                                        }
                                    })
                                })
                            } catch (err) {
                                thickLog(`Failed to reorder ${msg.docId} in ${msg.collectionPath} because ${err.message}`, { color: 'Red' })
                            }
                            return { type: 'dbsChangeResp', successful: true };
                        case 'push':
                            try {
                                let pushUpdate = {} as any
                                pushUpdate[msg.update.fieldPath] = msg.update.value;
                                let old = await (collection as Collection<any>).findOne({ _id: { $eq: msg.docId } })
                                let oldArr = (getFromPath(old, msg.update.fieldPath)) as Array<any> | undefined
                                let oldLength = oldArr ? oldArr.length : 0
                                await new Promise<void>(async (acc) => {
                                    let hasCompleted = false;
                                    (collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $push: pushUpdate }, { upsert: true }).then((result) => {
                                        if (!hasCompleted && result.modifiedCount == 0) {
                                            hasCompleted = true;
                                            acc();
                                        }
                                    })
                                    this.awaitFieldUpdate(msg.collectionPath, msg.docId, `${msg.update.fieldPath}.*`).then(() => {
                                        if (!hasCompleted) {
                                            hasCompleted = true;
                                            acc();
                                        }
                                    })
                                })
                            } catch (err) {
                                thickLog(`Failed to set push ${msg.update.fieldPath} on ${msg.docId}: ${JSON.stringify(msg.update.value)}:\n${err}`, { extra: err, color: 'Red' })
                                debugger;
                                return { type: 'Error', message: `Failed to set push ${msg.update.fieldPath} on ${msg.docId}: ${JSON.stringify(msg.update.value)}:\n${err}` };
                            }
                            return { type: 'dbsChangeResp', successful: true };
                        case 'remove':
                            try {
                                let removeUpdate = {} as any;
                                removeUpdate[`${msg.update.fieldPath}.${msg.update.index}`] = null
                                let pullUpdate = {} as any;
                                pullUpdate[msg.update.fieldPath] = null
                                await Promise.all([
                                    (collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $set: removeUpdate }).then(() =>
                                        (collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $pull: pullUpdate })),
                                    this.awaitFieldUpdate(msg.collectionPath, msg.docId, `${msg.update.fieldPath}.*`)
                                ])

                            } catch (err) {
                                thickLog(`Failed to remove index ${msg.update.index} from ${msg.update.fieldPath} on ${msg.docId}: ${err}`, { extra: err, color: 'Red' })
                            }
                            return { type: 'dbsChangeResp', successful: true };
                        case 'set':
                            let updateObj = {} as any
                            updateObj[msg.update.fieldPath] = msg.update.value;

                            try {
                                let hasCompleted = false;
                                await new Promise<void>((acc) => {

                                    (collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $set: updateObj }).then((result) => {
                                        if (!hasCompleted && result.modifiedCount == 0) {
                                            hasCompleted = true;
                                            acc();
                                        }
                                    })
                                    this.awaitFieldUpdate(msg.collectionPath, msg.docId, msg.update.fieldPath).then(() => {
                                        if (!hasCompleted) {
                                            hasCompleted = true;
                                            acc();
                                        }
                                    })
                                });


                                // thickLog(`Update complete ${msg.docId}.${msg.update.fieldPath}`)
                            } catch (err) {
                                thickLog(`Failed to set ${msg.update.fieldPath} on ${msg.docId} to ${JSON.stringify(updateObj)}:\n${err}`, { extra: err, color: 'Red' })
                                debugger;
                                return { type: 'Error', message: `Failed to set ${msg.update.fieldPath} on ${msg.docId} to ${JSON.stringify(updateObj)}:\n${err}` }
                            }
                            return { type: 'dbsChangeResp', successful: true };

                        default:
                            thickLog(`Unknown change op: ${(msg.update as any).op}`, { color: 'Red' })
                            return { type: 'Error', message: `Unknown change op: ${(msg.update as any).op}` }
                    }
                }
            },
            defaultState() {
                return { userId: null, workspaceId: null }
            },
        })
    }

    private getEventifier<CollectionPath extends DBS_CollectionPath<DBS_Types>>(collectionPath: CollectionPath): CollectionStreamWatcher<DBS_Types, CollectionPath> {
        let tifire = this.eventifiers.get(collectionPath)
        if (tifire) {
            return tifire;
        }
        let collection = this.getCollection(collectionPath);
        if (!collection) {
            throw new Error(`Can't find collection ${collectionPath}`)
        }
        // let stream = collection.watch(undefined, { fullDocument: 'updateLookup' })
        let ths = this;
        tifire = new CollectionStreamWatcher(collectionPath, collection, (cp) => {
            ths.eventifiers.delete(collectionPath)
            tifire?.destroy();
        })
        this.eventifiers.set(collectionPath, tifire);
        return tifire
    }
    watchChanges<CollectionPath extends DBS_CollectionPath<DBS_Types>>(collectionPath: CollectionPath, watch: CollectionChangeStreamWatcher<DBS_Types, CollectionPath>) {
        let eventifier = this.getEventifier(collectionPath);
        return eventifier.on(watch)
    }

    // private async recieveChangeRequest<CollectionPath extends DBS_CollectionPath<DBS_Types> & string>(msg: MSG_DBS_CollectionUpdateRequest<DBS_Types, CollectionPath>): Promise<MSG_DBS_CollectionUpdateRequest<DBS_Types, CollectionPath> & {type: 'dbsChangeResp'}> {
    //     // thickLog(`Change request ${msg.docId} ${msg.update.fieldPath} ${msg.update.op}`)

    // }
    // private onChange<CollectionPath extends DBS_CollectionPath<DBS_Types>>(collectionPath: CollectionPath, evt: ChangeStreamDocument<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>) {
    //     let burlap = this.burlap as Burlap<DBS_Protocol<DBS_Types>>
    //     switch (evt.operationType) {
    //         case 'insert':

    //             burlap.emitEvent('dbsCollectionUpdate', { collectionPath: collectionPath, documentId: evt.fullDocument._id, op: 'insert', document: evt.fullDocument })
    //             break;
    //         case 'delete':
    //             burlap.emitEvent('dbsCollectionUpdate', { collectionPath: collectionPath, op: 'remove', documentId: evt.documentKey._id as any })
    //             break;
    //         case 'update':
    //             // thickLog(`Mongo update ${evt.documentKey._id} ${Object.keys(evt.updateDescription.updatedFields).join(', ')}`)
    //             for (let key of Object.keys(evt.updateDescription.updatedFields as { [k: string]: any })) {
    //                 this.fieldUpdateWaiters.notify(`${collectionPath}.${evt.documentKey._id}.${key}`)
    //                 // this.fieldUpdateWaiters.get(`${evt.documentKey._id}.${key}`)?.forEach(callback => {
    //                 // thickLog(`Clearing update waiter ${evt.documentKey._id}.${key}`)
    //                 //     callback()
    //                 // })
    //                 // this.fieldUpdateWaiters.delete(`${evt.documentKey._id}.${key}`)
    //             }
    //             for (let key of evt.updateDescription.removedFields ?? []) {
    //                 thickLog(`Removed ${key}`)
    //             }
    //             burlap.emitEvent('dbsCollectionUpdate', { collectionPath: collectionPath, documentId: evt.documentKey._id as any as string, op: 'update', updatedFields: evt.updateDescription.updatedFields as any, removedFields: evt.updateDescription.removedFields as any })

    //             break;
    //     }
    // }

    private async awaitFieldUpdate<CollectionPath extends DBS_CollectionPath<DBS_Types>>(collectionPath: CollectionPath, docId: string, fieldPath: string) {
        let ths = this;
        return new Promise<void>((acc) => {
            // ths.fieldUpdateWaiters.addCallback(`${collectionPath}.${docId}.${fieldPath}`, acc)
            let cancelWatcher = ths.watchChanges(collectionPath, {
                filter(collectionPath, change, doc) {
                    if (change.operationType == 'update') {
                        if (change.documentKey._id as any as string == docId && change.updateDescription.updatedFields) {
                            for (let key of Object.keys(change.updateDescription.updatedFields)) {
                                if (matchesWildcard(key, fieldPath)) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                },
                callback: () => {
                    cancelWatcher();
                    acc();
                }
            })
        })
    }
    // private fieldUpdateWaiters: CallbackMap<void> = new CallbackMap(true);
}


// export class DBS_Server_Collection<CollectionPath extends DBS_CollectionPath<DBS_Types>, DBS_Types extends {}> {

//     burlap: Burlap<DBS_Protocol<DBS_Types>>;
//     collection: Collection<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>;
//     dbsPath: CollectionPath;
//     eventifier: ChangeStreamEventifier<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>;
//     constructor(dbsPath: CollectionPath, collection: Collection<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>, backend: Burlap<DBS_Protocol<DBS_Types>>) {
//         this.burlap = backend;
//         this.dbsPath = dbsPath;
//         this.collection = collection;
//         let ths = this;
//         let stream = collection.watch([], {})
//         this.eventifier = new ChangeStreamEventifier<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>(stream, (evt) => {
//             ths.onChange(evt);
//         })
//     }
//     destroy() {
//         this.eventifier.stop()
//     }
//     private async awaitFieldUpdate(docIdAndFieldPath: string) {
//         let ths = this;
//         return new Promise<void>((acc) => {

//             ths.fieldUpdateWaiters.addCallback(docIdAndFieldPath, acc)

//         })
//     }
//     private fieldUpdateWaiters: CallbackMap<void> = new CallbackMap(true);
//     private onChange(evt: ChangeStreamDocument<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>) {
//         switch (evt.operationType) {
//             case 'insert':

//                 this.burlap.emitEvent('dbsCollectionUpdate', { collectionPath: this.dbsPath, documentId: evt.fullDocument._id, op: 'insert', document: evt.fullDocument })
//                 break;
//             case 'delete':
//                 this.burlap.emitEvent('dbsCollectionUpdate', { collectionPath: this.dbsPath, op: 'remove', documentId: evt.documentKey._id as any })
//                 break;
//             case 'update':
//                 // thickLog(`Mongo update ${evt.documentKey._id} ${Object.keys(evt.updateDescription.updatedFields).join(', ')}`)
//                 for (let key of Object.keys(evt.updateDescription.updatedFields as { [k: string]: any })) {
//                     this.fieldUpdateWaiters.notify(`${collec}${evt.documentKey._id}.${key}`)
//                     // this.fieldUpdateWaiters.get(`${evt.documentKey._id}.${key}`)?.forEach(callback => {
//                     // thickLog(`Clearing update waiter ${evt.documentKey._id}.${key}`)
//                     //     callback()
//                     // })
//                     // this.fieldUpdateWaiters.delete(`${evt.documentKey._id}.${key}`)
//                 }
//                 for (let key of evt.updateDescription.removedFields ?? []) {
//                     thickLog(`Removed ${key}`)
//                 }
//                 this.burlap.emitEvent('dbsCollectionUpdate', { collectionPath: this.dbsPath, documentId: evt.documentKey._id as any as string, op: 'update', updatedFields: evt.updateDescription.updatedFields as any, removedFields: evt.updateDescription.removedFields as any })

//                 break;
//         }
//     }

//     // private emitEvent(evt: SEVT_DBS_CollectionUpdate<DBS_Types, CollectionPath>['packet']) {
//     //     this.burlap.emitEvent('dbsCollectionUpdate',evt as any)
//     //     // this.backend.notifySubscribers(`dbs|${this.dbsPath}`, evt)
//     // }
//     async deleteDocument(key: string) {
//         let result = await (this.collection as any as Collection<{ _id: string }>).deleteOne({ _id: key })
//         return result.acknowledged && result.deletedCount == 1
//     }
//     async recieveChangeRequest<FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>(msg: MSG_DBS_CollectionUpdateRequest<DBS_Types, CollectionPath>) {
//         // thickLog(`Change request ${msg.docId} ${msg.update.fieldPath} ${msg.update.op}`)
//         if (msg.type != 'dbsChangeReq') {
//             throw new Error(`Not expecting responses ${msg.type}`)
//         }
//         let ths = this;
//         switch (msg.update.op) {
//             case 'move':
//                 try {
//                     let old = await (ths.collection as Collection<any>).findOne({ _id: { $eq: msg.docId } })

//                     let oldArr = (getFromPath(old, msg.update.fieldPath)) as Array<any> | undefined
//                     if (oldArr) {
//                         if (msg.update.fromIndex < 0 || msg.update.fromIndex >= oldArr.length) {
//                             thickLog(`Can't move item from index ${msg.update.fromIndex} > old length ${oldArr.length}`, { color: 'Red' })
//                             return false;
//                         }
//                         if (msg.update.toIndex < 0 || msg.update.toIndex >= oldArr.length) {
//                             thickLog(`Can't move item to index ${msg.update.fromIndex} > old length ${oldArr.length}`, { color: 'Red' })
//                             return false;
//                         }

//                         switch (msg.update.moveType) {
//                             case 'SwitchIndicies':
//                                 let tmp = oldArr[msg.update.toIndex]
//                                 oldArr[msg.update.toIndex] = oldArr[msg.update.fromIndex]
//                                 oldArr[msg.update.fromIndex] = tmp;
//                                 break;
//                             case 'moveFromShiftOthers':
//                                 let temp = oldArr[msg.update.fromIndex]
//                                 let withoutFrom = oldArr.slice(0, msg.update.fromIndex).concat(oldArr.slice(msg.update.fromIndex + 1))
//                                 oldArr = withoutFrom.slice(0, msg.update.toIndex).concat([temp], withoutFrom.slice(msg.update.toIndex))
//                                 break;
//                         }
//                     }
//                     let pushUpdate = {} as any
//                     pushUpdate[msg.update.fieldPath] = oldArr
//                     await new Promise<void>(async (acc) => {
//                         let hasCompleted = false;
//                         (this.collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $set: pushUpdate }, { upsert: true }).then((result) => {
//                             if (!hasCompleted && result.modifiedCount == 0) {
//                                 hasCompleted = true;
//                                 acc();
//                             }
//                         })
//                         this.awaitFieldUpdate(`${msg.docId}.${msg.update.fieldPath}.*`).then(() => {
//                             if (!hasCompleted) {
//                                 hasCompleted = true;
//                                 acc();
//                             }
//                         })
//                     })
//                 } catch (err) {
//                     thickLog(`Failed to reorder ${msg.docId} in ${msg.collectionPath} because ${err.message}`, { color: 'Red' })
//                 }
//                 return true;
//             case 'push':
//                 try {
//                     let pushUpdate = {} as any
//                     pushUpdate[msg.update.fieldPath] = msg.update.value;
//                     let old = await (ths.collection as Collection<any>).findOne({ _id: { $eq: msg.docId } })
//                     let oldArr = (getFromPath(old, msg.update.fieldPath)) as Array<any> | undefined
//                     let oldLength = oldArr ? oldArr.length : 0
//                     await new Promise<void>(async (acc) => {
//                         let hasCompleted = false;
//                         (this.collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $push: pushUpdate }, { upsert: true }).then((result) => {
//                             if (!hasCompleted && result.modifiedCount == 0) {
//                                 hasCompleted = true;
//                                 acc();
//                             }
//                         })
//                         this.awaitFieldUpdate(`${msg.docId}.${msg.update.fieldPath}.*`).then(() => {
//                             if (!hasCompleted) {
//                                 hasCompleted = true;
//                                 acc();
//                             }
//                         })
//                     })
//                 } catch (err) {
//                     thickLog(`Failed to set push ${msg.update.fieldPath} on ${msg.docId}: ${JSON.stringify(msg.update.value)}:\n${err}`, { extra: err, color: 'Red' })
//                     debugger;
//                     return false;
//                 }
//                 return true;
//             case 'remove':
//                 try {
//                     let removeUpdate = {} as any;
//                     removeUpdate[`${msg.update.fieldPath}.${msg.update.index}`] = null
//                     let pullUpdate = {} as any;
//                     pullUpdate[msg.update.fieldPath] = null
//                     await Promise.all([
//                         (this.collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $set: removeUpdate }).then(() =>
//                             (this.collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $pull: pullUpdate })),
//                         this.awaitFieldUpdate(`${msg.docId}.${msg.update.fieldPath}.*`)
//                     ])

//                 } catch (err) {
//                     thickLog(`Failed to remove index ${msg.update.index} from ${msg.update.fieldPath} on ${msg.docId}: ${err}`, { extra: err, color: 'Red' })
//                 }
//                 return true;
//             case 'set':
//                 let updateObj = {} as any
//                 updateObj[msg.update.fieldPath] = msg.update.value;

//                 try {
//                     let hasCompleted = false;
//                     await new Promise<void>((acc) => {

//                         (this.collection as Collection<any>).updateOne({ _id: { $eq: msg.docId } }, { $set: updateObj }).then((result) => {
//                             if (!hasCompleted && result.modifiedCount == 0) {
//                                 hasCompleted = true;
//                                 acc();
//                             }
//                         })
//                         this.awaitFieldUpdate(`${msg.docId}.${msg.update.fieldPath}`).then(() => {
//                             if (!hasCompleted) {
//                                 hasCompleted = true;
//                                 acc();
//                             }
//                         })
//                     });


//                     // thickLog(`Update complete ${msg.docId}.${msg.update.fieldPath}`)
//                 } catch (err) {
//                     thickLog(`Failed to set ${msg.update.fieldPath} on ${msg.docId} to ${JSON.stringify(updateObj)}:\n${err}`, { extra: err, color: 'Red' })
//                     debugger;
//                     return false;
//                 }
//                 return true;

//             default:
//                 thickLog(`Unknown change op: ${(msg.update as any).op}`, { color: 'Red' })
//                 return false;
//         }
//     }
//     async listDocuments(filter: DBS_Filter<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>, sort: DBS_Sort<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>): Promise<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>[]> {
//         return this.collection.find(filter as any).sort(sort as any).toArray() as any;
//     }
// }

type CollectionStreamWatcherCallback<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> = (collectionPath: CollectionPath, change: ChangeStreamDocument<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>) => void
type CollectionChangeStreamWatcher<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> = { filter: DBS_Filter<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>> | ((collectionPath: CollectionPath, change: ChangeStreamDocument<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>, doc?: DBS_CollectionPath_GetType<DBS_Types, CollectionPath>) => boolean), callback: CollectionStreamWatcherCallback<DBS_Types, CollectionPath> }
export class CollectionStreamWatcher<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> {
    private collection: Collection<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>;
    private callbackCount = 0;
    private callbacks: Map<number, CollectionChangeStreamWatcher<DBS_Types, CollectionPath>> = new Map()
    private watcher: ChangeStreamEventifier<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>;
    private onEmpty: (collectionPath: CollectionPath) => void;
    collectionPath: CollectionPath;
    constructor(collectionPath: CollectionPath, collection: Collection<DBS_CollectionPath_GetType<DBS_Types, CollectionPath> & Document>, onEmpty: (collectionPath: CollectionPath) => void) {
        this.collection = collection;
        this.collectionPath = collectionPath;
        this.onEmpty = onEmpty;
        let ths = this;
        let stream = collection.watch(undefined, { fullDocument: 'updateLookup', fullDocumentBeforeChange: 'required' })
        this.watcher = new ChangeStreamEventifier(stream, async (doc) => {
            let fullDoc: any = null;

            if (doc.operationType == 'delete') {
                fullDoc = doc.fullDocumentBeforeChange;
            } else if (typeof doc['fullDocument'] == 'object') {
                let fullDoc = doc['fullDocument']
            }
            if (fullDoc) {
                for (let cbPlusFilter of ths.callbacks.values()) {
                    if (typeof cbPlusFilter.filter == 'function') {
                        if (cbPlusFilter.filter(collectionPath, doc, fullDoc)) {
                            cbPlusFilter.callback(collectionPath, doc);
                        }
                    } else {
                        if (matchesFilter(fullDoc, cbPlusFilter.filter as any)) {
                            cbPlusFilter.callback(collectionPath, doc);
                        }
                    }

                }
            } else {
                thickLog(`Unknown update op: ${doc.operationType}`)
            }


        })

    }
    destroy() {
        this.watcher.stop();
    }
    on(cbOptions: CollectionChangeStreamWatcher<DBS_Types, CollectionPath>) {
        let id = this.callbackCount++;
        this.callbacks.set(id, cbOptions)
        let ths = this;
        return () => {
            ths.callbacks.delete(id);
            if (ths.callbacks.size == 0) {
                ths.onEmpty(ths.collectionPath);
            }
        }
    }
}

export function matchesCondition<T>(obj: T, filter: DBS_Condition<T>) {
    let keys: (keyof DBS_Condition<T>)[] = Object.keys(filter) as any;
    if (keys.length < 1) {
        return true;
    }
    switch (keys[0] as keyof DBS_Condition<T>) {
        case '$eq':
            return obj == filter['$eq']
        case '$gt':
            return obj > filter['$eq']
        case '$lt':
            return obj < filter['$eq']
    }
    return false;
}
export function matchesFilter<dbObj extends {}>(obj: dbObj, filter: DBS_Filter<dbObj>): boolean {
    for (let [k, v] of Object.entries(filter)) {
        let value = getFromPath(obj, k as any)
        if (!value) {
            return false;
        }
        if (v && !matchesCondition(value, v)) {
            return false;
        }
    }
    return true;
}

export type MongoCollections<CollectionTypes> = {
    [P in keyof CollectionTypes]: CollectionTypes[P] extends Document ? Collection<CollectionTypes[P]> : `Bad collection def: ${P & (string | number)}`
}
export type RemoveWithIdType<T> = T extends WithId<infer sub> ? sub :
    T extends Array<infer subOfArr> ? RemoveWithIdType<subOfArr>[] :
    T
export function removeWithId<T>(t: T): RemoveWithIdType<T> {
    return t as any;
}