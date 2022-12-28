import { ArrToObj, ArrayToUnion, IsUnion, ObjWithField, PathInto, PopUnion, Protocol_GetState, SucketProtocol, TestTypeA, TestTypeCompound, TypeFromPath, UnionToArray } from "../CommonImports";

export type MOS<T> = IsUnion<T> extends true ? MosUnion<UnionToArray<T>> : (T extends {} ? MosNonUnion<T> : {badMember: T})
export type MosUnion<Types extends unknown[], Output extends unknown = null> = Types extends [infer first, ...infer rest] ? MosUnion<rest,Output extends null ? MOS<first> : Output | MOS<first>> : Output
export type MosNonUnion<T extends {}> = {
    readonly [P in keyof T]:  JSTypeOf<T[P]> extends 'object' ? (T[P] extends {} ? MOS<T[P]> : T[P]) :
     JSTypeOf<T[P]> extends 'array' ? MOSArr<T[P]> : T[P]
    // T[P] extends Array<infer sub> ? MOSArr<sub> :
    // IsObject<T[P]> extends true ? MOS<T[P]> :
    // T[P]
} & MosSetters<T>

export type MosSetters<T extends {}> = {
    [P in keyof T as P extends `_id` ? never : `set${Capitalize<P & string>}`]: (p: T[P])=>void//(t: T[P]) => Promise<void>
}

export type MOSArr<subType> = {
    length: number
    map: <T>(transform: (item: subType, index: number, arr: MOSArr<subType>) => T) => T[]
    forEach: (onEach: (item: subType, index: number, arr: MOSArr<subType>) => void) => void
    [Symbol.iterator]: Iterator<subType>
} & {
    readonly [index: number]: subType
}

export type MOS_CollectionId = {dbName: string, collectionName: string}
export type MOS_DocumentPath = MOS_CollectionId & {documentId: string}
export type MOS_Condition<T> = { $eq: T } | { $lt: T } | { $gt: T }
export type MOS_Filter<T> = {
    [P in PathInto<T>]?: MOS_Condition<TypeFromPath<T, P>>
}
export type MOS_Sort<T> = {
    [P in PathInto<T>]?: number
}


export type MOS_CollectionPermissionPredicates<MOS_Database_Types extends {}, Protocol extends SucketProtocol> = {
    [P in keyof MOS_Database_Types]: (targetObj: MOS_Database_Types[P], state: Protocol_GetState<Protocol>, dbName: string) => MOS_Permission | Promise<MOS_Permission>
}
export type MOS_PermissionPredicates<MOS_Database_Types extends {}, Protocol extends SucketProtocol> = {
    [P in keyof MOS_Database_Types]: MOS_Database_Types[P] extends {} ? MOS_CollectionPermissionPredicates<MOS_Database_Types[P], Protocol> : `Bad collection definition: ${P & (string | number)}`
}
export type MOS_Permission = 'none' | 'read' | 'write'
export function mosPermissionToInt(perm: MOS_Permission) {
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

export type IsObject<T> = T extends (string | number | boolean | symbol) ? false :
    T extends Array<infer sub> ? false :
    true;

export type IsTuple<T extends unknown[]> = T extends [infer first, ...infer rest] ? true : false

let testIsTuple: IsTuple<['stuff', { things: boolean }, 1]> = true
let testIsTuple2: IsTuple<string[]> = false

export type JSType = 'object' | 'tuple' | 'array' | 'number' | 'symbol' | 'boolean' | 'string' | 'unknown'
export type JSTypeOf<T> = (IsObject<T> extends true ? 'object' :
    T extends Array<infer s> ? (IsTuple<T> extends true ? 'tuple' : 'array') :
    T extends number ? 'number' :
    T extends symbol ? 'symbol' :
    T extends boolean ? 'boolean' :
    T extends string ? 'string' : 'unknown') & JSType
export type JSFieldTypeFilter<Obj, FieldTypes> = {
    [P in keyof Obj as JSTypeOf<Obj[P]> extends FieldTypes ? P : never]: Obj[P]
}
export type JSFieldTypeNotFilter<Obj, FieldTypes> = {
    [P in keyof Obj as JSTypeOf<Obj[P]> extends FieldTypes ? never : P]: Obj[P]
}

// let isObjTest: IsObject<()=>void> = true
let unionTest: IsUnion<'stuff' | 'things'> = true
let unionTest2: IsUnion<'stuff'> = false;
let jsFieldTypeFilterTest: JSFieldTypeFilter<{ strStuff: 'things', boolStuff: true, otherSTuff: { goodStuff: string, badStuff: number } }, 'object' | 'string'> = {
    otherSTuff: { badStuff: 1, goodStuff: '' }, strStuff: 'things'
}



let mosTest: MOS<TestTypeCompound> = {} as any;
if(mosTest.typee == 'B'){
    mosTest.setBData({stuff: 23})
    mosTest.bData.setStuff(12);
}
