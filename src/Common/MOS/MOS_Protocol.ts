
import { EventTemplate, DBS_CollectionPath, DBS_CollectionPath_GetType, DBS_Filter, DBS_Move_Type, DBS_Sort, PathInto, TypeFromPath, MOS_Filter, MOS_Sort, MOS_CollectionId as MOS_CollectionPath, MOS_DocumentPath, } from "../CommonImports"

// export type MSG_Connect = { type: 'connectReq', firebaseAuth?: string } | {type: 'connectResp', succ: boolean, authenticated: boolean }
// export type MSG_Auth = {type: 'authReq', firebaseAuth: string} | {type: 'authSuccess'}
// export type MSG_DBS_CollectionListRequest<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> = {
//     type: 'dbsCollectionListReq',
//     collectionPath: CollectionPath
//     filter?: DBS_Filter<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>
//     sort?: DBS_Sort<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>
// } | {
//     type: 'dbsCollectionListResp',
//     documents: DBS_CollectionPath_GetType<DBS_Types, CollectionPath>[]
// }
// export type MSG_DBS_CollectionInsertRequest<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> = {
//     type: 'dbsCollectionInsertReq',
//     document: Omit<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, '_id'> & { _id?: string }
//     collectionPath: CollectionPath
// } | {
//     type: 'dbsCollectionInsertResp',
//     document: DBS_CollectionPath_GetType<DBS_Types, CollectionPath>
// }
// export type MSG_DBS_CollectionDeleteRequest<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> = {
//     type: 'dbsCollectionDeleteReq',
//     documentId: string
//     collectionPath: CollectionPath
// } | {
//     type: 'dbsCollectionDeleteResp',
//     success: boolean
// }
// type MSG_DBS_CollectionUpdateRequest_Helper<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>, FieldPath extends PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>> = {

//     update: DBS_CollectionUpdate<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, FieldPath>
// }
// export type MSG_DBS_CollectionUpdateRequest<DBS_Types extends {}, CollectionPath extends DBS_CollectionPath<DBS_Types>> = ({
//     type: 'dbsChangeReq',
//     collectionPath: CollectionPath,
//     docId: string,
//     // fieldPath: FieldPath
//     update: DBS_CollectionUpdate<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>, PathInto<DBS_CollectionPath_GetType<DBS_Types, CollectionPath>>>
// }) | {
//     type: 'dbsChangeResp',
//     successful: boolean
// }
// // export type DBS_Move_Type = 'SwitchIndicies' | 'moveFromShiftOthers'
// export type DBS_CollectionUpdate<dbObject, FieldPath extends PathInto<dbObject>> = ((TypeFromPath<dbObject, FieldPath> extends Array<infer subType> ? ({ op: 'set', value: TypeFromPath<dbObject, FieldPath> } | { op: 'move', fromIndex: number, toIndex: number, moveType: DBS_Move_Type } | { op: 'push', value: subType } | { op: 'remove', index: number }) : ({ op: 'set', value: TypeFromPath<dbObject, FieldPath> }))) & {
//     fieldPath: FieldPath
// }

// export type DBS_MSG<DBS_Types extends {}> = MSG_DBS_CollectionUpdateRequest<DBS_Types, DBS_CollectionPath<DBS_Types>> |
//     MSG_DBS_CollectionListRequest<DBS_Types, DBS_CollectionPath<DBS_Types>> |
//     MSG_DBS_CollectionInsertRequest<DBS_Types, DBS_CollectionPath<DBS_Types>> |
//     MSG_DBS_CollectionDeleteRequest<DBS_Types, DBS_CollectionPath<DBS_Types>>
// export type DoppioSEVT = {}

export type MSG_MOS_InitCollection<CollectionType extends {}> = {
    type: 'mosInitCollectionReq',
    dbName: string
    //     collectionPath: CollectionPath
    filter?: MOS_Filter<CollectionType>
    sort?: MOS_Sort<CollectionType>
} | {
    type: 'mosInitCollectionResp',
    documents: CollectionType[]
}
export type MSG_MOS<CollectionType extends {}> = MSG_MOS_InitCollection<CollectionType>
export type SEVT_MOS_CollectionUpdate<CollectionType extends {}> = EventTemplate<'mosCollectionUpdate', { collectionId: MOS_CollectionPath }, {path: MOS_DocumentPath} & ({
    op: 'insert',
    document: CollectionType
} | {
    op: 'remove',

} | {
    op: 'update',

    updatedFields: { [P in PathInto<CollectionType>]: TypeFromPath<CollectionType, P> }
    removedFields: PathInto<CollectionType>[]
})>

export type MOS_SEVT<DBS_Types extends {}> = SEVT_MOS_CollectionUpdate<DBS_Types>
export type MOS_Protocol<DBS_Types extends {}> = { reqRespTypes: MSG_MOS<DBS_Types>, eventTypes: MOS_SEVT<DBS_Types>, state: { userId: string | null } }