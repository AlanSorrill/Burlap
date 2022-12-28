
import { Document } from 'mongodb'
import { Protocol_GetState, SucketProtocol, MatchWildcardFieldNames, PathFlatten, PathFlattenObj, PathInto,  StringifyWildcards,  TypeFromPath, ValidatableKeys, } from '../CommonImports'





export type DBS_Permission = 'none' | 'read' | 'write'
export function dbsPermissionToInt(perm: DBS_Permission) {
    switch (perm) {
        default:
        case 'none':
            return 0;
        case 'read':
            return 1;
        case 'write':
            return 2;
    }
}
// export type DBS_CollectionTypes = DBS_CollectionTypes_WorkspaceDb | DBS_CollectionTypes_DoppioDb

// export type DBS_Database<CollectionTypes extends {}> = {

// }
// export type DBS_Collection<DocumentType extends {}> = {
//     [p in (keyof DocumentTypes & string)]: 
// }

// export type DBS_CollectionPath_DOPIO = `DoppioDb.${keyof DBS_CollectionTypes_DoppioDb}` | `${WorkspaceId}.${keyof DBS_CollectionTypes_WorkspaceDb}`
// export type DBS_CollectionType<cPath extends DBS_CollectionPath_DOPIO> = cPath extends `DoppioDb.${infer subType}` ? DBS_CollectionTypes_DoppioDb[subType & (keyof DBS_CollectionTypes_DoppioDb)] : (cPath extends `${infer workspaceId}.${infer subType}` ? (subType extends keyof DBS_CollectionTypes_WorkspaceDb ? DBS_CollectionTypes_WorkspaceDb[subType] : never) : never)
// export type DBS_CollectionPathWithId = `${DBS_CollectionPath_DOPIO}.${string}`

export type DBObject = {}
export type DBS_ArrayFieldKeys<dbObject> = { [P in keyof dbObject]: dbObject[P] extends Array<infer SubType> ? P : never }[keyof dbObject & string]
export type DBS_ArrayFields<dbObject> = Pick<dbObject, DBS_ArrayFieldKeys<dbObject>>

export type DBS_ObjFieldKeys<dbObject> = {
    [P in keyof dbObject]: dbObject[P] extends string ? never :
    dbObject[P] extends Array<infer subType> ? never :
    (dbObject[P] extends Object ? P : never)
}[keyof dbObject & string]
export type DBS_ObjFields<dbObject> = Pick<dbObject, Exclude<DBS_ObjFieldKeys<dbObject>, DBS_ArrayFieldKeys<dbObject>>>

export type DBS_ValidatableKeys<dbObject> = {
    [P in keyof dbObject]: dbObject[P] extends Array<infer sub> ? (sub extends {} ? never : P) :
    dbObject[P] extends number ? never : P
}[keyof dbObject & string]



export type DBS_CollectionNameMap = {
    [key: string]: {}
}
export type DBS_CollectionPermissionPredicates<DBS_Collection_Types extends {}, Protocol extends SucketProtocol> = {
    [P in keyof DBS_Collection_Types]: (targetObj: DBS_Collection_Types[P], state: Protocol_GetState<Protocol>, dbName: string) => DBS_Permission | Promise<DBS_Permission>
}
export type DBS_PermissionPredicates<DBS_Types extends {}, Protocol extends SucketProtocol> = {
    [P in keyof DBS_Types]: DBS_Types[P] extends {} ? DBS_CollectionPermissionPredicates<DBS_Types[P], Protocol> : `Bad collection definition: ${P & (string | number)}`
}
export type DBS_CombineCollections<DBS_Types extends {}, OutNames> = {
    [P in keyof PathInto<DBS_Types>]: P extends string ? TypeFromPath<DBS_Types, P> : `Unknown p`
}

export type DBS_CollectionPath<DBS_Types extends {}> = StringifyWildcards<PathFlatten<DBS_Types>>
export type DBS_CollectionPath_GetType<DBS_Types extends {}, CollectionPath> = CollectionPath extends DBS_CollectionPath<DBS_Types> ? (MatchWildcardFieldNames<CollectionPath, PathFlattenObj<DBS_Types>> & {_id: string}) : {_id: 'bad', msg: `Bad collection path`, path: CollectionPath }

export type DBS_CollectionAddress = { domain: 'DoppioDb' } | { domain: 'WS', subDomain: string }

export type DBS_Move_Type = 'SwitchIndicies' | 'moveFromShiftOthers'
export type DBS_Array<subType> = ReadonlyArray<DBS_Field<subType>> & {
    onItemSet: (callback: (newValue: subType, index: number) => void) => (() => void)
    onThisSet: (callback: (newValue: DBS_Array<subType>) => void) => (() => void)
    setThis: (value: DBS_Array<subType>) => Promise<void>
    push: (value: subType) => Promise<void>
    remove: (indexOrPredicate: number | ((item: any, index: number, arr: Array<any>) => boolean)) => Promise<void>
    includes: (item: subType) => boolean
    moveItem: (fromIndex: number, toIndex: number, moveType: DBS_Move_Type) => Promise<boolean>
    findIndex: (predicate: (item: subType, index: number, arr: subType[]) => boolean) => number
}


export type DBS_Field<dbField> = dbField extends boolean ? boolean :
    dbField extends string ? dbField :
    dbField extends Array<infer subType> ? DBS_Array<subType> :
    dbField extends { [key: string]: any } ? DBS<dbField> : dbField


export type DBS<dbObject extends DBObject> = {
    readonly [Prop in keyof dbObject]: DBS_Field<dbObject[Prop]>
} & {
        [Prop in keyof Omit<dbObject, '_id'> as `set${Capitalize<Prop & string>}`]: (value: dbObject[Prop]) => Promise<void>
    } & {
        [Prop in keyof Omit<dbObject, '_id'> as `on${Capitalize<Prop & string>}Set`]: (callback: (newValue: DBS_Field<dbObject[Prop]>) => void) => (() => void)
    } & {
        [Prop in DBS_ArrayFieldKeys<dbObject> as `on${Capitalize<Prop & string>}Inserted`]: dbObject[Prop] extends Array<infer subType> ? (callback: (index: number, newValue: DBS_Field<subType>) => void) => (() => void) : ''
    } & {
        [Prop in DBS_ArrayFieldKeys<dbObject> as `on${Capitalize<Prop & string>}Removed`]: dbObject[Prop] extends Array<infer subType> ? (callback: (index: number) => void) => (() => void) : ''
    } & {
        [Prop in ValidatableKeys<dbObject> as `isValidFor${Capitalize<Prop & string>}`]: (value: dbObject[Prop]) => (Promise<true | string>)
    } & {
        [Prop in ValidatableKeys<dbObject> as `is${Capitalize<Prop & string>}Valid`]: () => (Promise<true | string>)
    } & {
        [Prop in ValidatableKeys<dbObject> as `on${Capitalize<Prop & string>}ValidityChanged`]: (callback: () => (Promise<true | string>)) => (() => void)
    } & {
        [Prop in DBS_ObjFieldKeys<dbObject> as `on${Capitalize<Prop & string>}ChildInserted`]: (callback: (key: keyof dbObject, newValue: DBS_Field<dbObject[keyof dbObject]>) => void) => (() => void)
    } & {
        [Prop in DBS_ObjFieldKeys<dbObject> as `on${Capitalize<Prop & string>}ChildRemoved`]: (callback: (key: keyof dbObject, newValue: DBS_Field<dbObject[keyof dbObject]>) => void) => (() => void)
    } & {
        onThisSet: (callback: (newValue: DBS_Field<dbObject>) => void) => (() => void)
        setThis: (value: DBS_Field<dbObject>) => Promise<void>
        solidify: () => Readonly<dbObject>
        getKeys: () => Array<keyof dbObject>
        onChildSet: (callback: () => void) => (() => void)
    } & {
        [Prop in DBS_ObjFieldKeys<dbObject> as `${Prop & string}GetDbsPath`]: () => string
    }

export type DBS_Condition<T> = { $eq: T } | { $lt: T } | { $gt: T }
export type DBS_Filter<T> = {
    [P in PathInto<T>]?: DBS_Condition<TypeFromPath<T, P>>
}
export type DBS_Sort<T> = {
    [P in PathInto<T>]?: number
}
