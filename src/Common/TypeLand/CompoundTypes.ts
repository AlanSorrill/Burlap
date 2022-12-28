import { ObjectToPairs, TestTypeA, TestTypeC, TestTypeCompound } from "../CommonImports";

// credits goes to https://stackoverflow.com/a/50375286
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
    k: infer I
) => void
    ? I
    : never;

// Converts union to overloaded function
type UnionToOvlds<U> = UnionToIntersection<
    U extends any ? (f: U) => void : never
>;



export type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// Credit to https://catchts.com/union-array)
export type UnionToArray<T, A extends unknown[] = []> = IsUnion<T> extends true
    ? UnionToArray<Exclude<T, PopUnion<T>>, [PopUnion<T>, ...A]>
    : [T, ...A];


type FieldsToUnionHelper<T extends {}, Keys extends unknown[], Out extends unknown = never> = Keys extends [infer FirstKey, ...infer rest] ? (FirstKey extends keyof T ? FieldsToUnionHelper<T, rest, T[FirstKey] | Out> : 'what') : Out
export type FieldsToUnion<T extends {}> = FieldsToUnionHelper<T, UnionToArray<keyof T>>

type TestyType = { stuff: { type: 'stuff', stuffData: boolean }, things: { type: 'things', thingsData: number } }
let tt: FieldsToUnion<TestyType>



let isUnionTestF: IsUnion<TestTypeA> = false;
let isUnionTestT: IsUnion<TestTypeCompound> = true;
let isUnionTestFF: IsUnion<'test'> = false;
let isUnionTestTT: IsUnion<'test' | 'testy'> = true;

export type IsStringLiteral<T extends string> = T extends `${infer first}` ? true : false
let isStringLiteralTestF: IsStringLiteral<string> = false
let isStringLiteralTestT: IsStringLiteral<''> = true;
let isStringLiteralTestTT: IsStringLiteral<'t'> = true;

type OnlyStringLiteralFields<T> = {
    [P in keyof T as T[P] extends string ? (IsStringLiteral<T[P]> extends true ? P : never) : never]: T[P]
}
let onlyStringLiteralFieldsTest: OnlyStringLiteralFields<TestTypeCompound> = { typee: 'C' }

type CommonKeysHelper<Children extends unknown[], Com extends (null | string) = null> =
    Children extends [infer first, ...infer rest] ?
    (Com extends null ? CommonKeysHelper<rest, (keyof first) & string> : CommonKeysHelper<rest, Extract<(keyof first) & string, Com>>) :
    Com

type CommonKeys<T> = IsUnion<T> extends true ? CommonKeysHelper<UnionToArray<T>> : false


let testCommonKeys: CommonKeys<OnlyStringLiteralFields<TestTypeCompound>>
let testCommonKeys2: CommonKeys<OnlyStringLiteralFields<TestTypeA>>


function fis(f): f is string {
    return true;
}
// type UnionPivotHelper<ChildTypes extends unknown[], CommonKeys extends unknown[] = []> = ChildTypes extends [infer first, ...infer rest] ?
//     (CommonKeys extends [] ? UnionPivotHelper<rest,[]>) : 'bad'
// type UnionPivHelper<T, CommonKey extends string, ChildTypes extends unknown[], Output extends {} = {}> =
//     ChildTypes extends [infer first, ...infer rest] ? (CommonKey extends keyof first ? (first[CommonKey] extends string ? UnionPivHelper<T, CommonKey, rest, Output & {
//         [P in CommonKey as `is${Capitalize<CommonKey>}${Capitalize<first[CommonKey]>}`]: () => T is first
//     }> : 'Bad value') : `Bad key`) : Output
// export type UnionPivot<T> = CommonKeys<OnlyStringLiteralFields<T>> extends string ? UnionPivHelper<T, CommonKeys<OnlyStringLiteralFields<T>>, UnionToArray<T>> : false

// let unionPivotKeyTest: UnionPivot<TestTypeCompound> = {} as any;
// unionPivotKeyTest.isTypeeA()
// unionPivotKeyTest.isTypeeB();
// type Test<T,Other> = {
//     [P in keyof T]: () => this is Other
// }