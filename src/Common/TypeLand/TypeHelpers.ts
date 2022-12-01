import { deCapitalizeFirstLetter } from '../CommonImports'
export * from './CompoundTypes'
export type RemovePostfix<Str extends string, Postfix extends string> = Str extends `${infer A}${Postfix}` ? A : Str
export type ArrToObjHelper<Arr extends unknown[], KeyField extends string, Out extends {} = {}> = Arr extends [infer SubType, ...infer Rest] ? (KeyField extends keyof SubType ? (ArrToObjHelper<Rest, KeyField, Out & { [P in SubType[KeyField] & string]: SubType }>) : `BadKey ${KeyField}`) : Out

export type KeysEndingWith_ReturnPrefix<Obj extends {}, Ending extends string> = {
    [P in keyof Obj]: P extends `${infer prefix}${Ending}` ? prefix : never
}[keyof Obj & string]
export type KeysEndingWith<Obj extends {}, Ending extends string> = {
    [P in keyof Obj]: P extends `${infer prefix}${Ending}` ? P : never
}[keyof Obj & string]
export type KeysNotEndingWith<Obj extends {}, Ending extends string> = {
    [P in keyof Obj]: P extends `${infer prefix}${Ending}` ? never : P
}[keyof Obj & string]

export type KeysStartingWith<Obj extends {}, Prefix extends string> = {
    [P in keyof Obj]: P extends `${Prefix}${infer ending}` ? P : never
}[keyof Obj & string]
export type KeysStartingWith_ReturnPostfix<Obj extends {}, Prefix extends string> = {
    [P in keyof Obj]: P extends `${Prefix}${infer postfix}` ? postfix : never
}[keyof Obj & string]

export type FieldsStartingWith<Obj extends {}, Prefix extends string> = RemoveNevers<{
    [P in keyof Obj]: P extends `${Prefix}${infer ending}` ? Obj[P] : never
}>

export type FieldsNotEndingWith<Obj extends {}, Ending extends string> = RemoveNevers<{
    [P in keyof Obj]: P extends `${infer prefix}${Ending}` ? never : Obj[P]
}>

export type RemoveNevers<T> = {
    [P in keyof T as T[P] extends never ? never : P]: T[P]
}

export type ReadOnlySetters<T extends {}> = Readonly<T> & {
    [P in keyof T as `set${Capitalize<P & string>}`]: (fresh: T[P]) => void
}

export function readOnlySettersProxy<T extends {}>(t: T): ReadOnlySetters<T> {
    return new Proxy(t, {
        get(target, key) {
            if(typeof key == 'string'){
                if(key.startsWith('set')){
                    let targetKey = deCapitalizeFirstLetter(key.substring(3))
                    console.log(`ReadOnlySetterProxy setting ${targetKey}`)
                    return (freshVal)=>{
                        target[targetKey] = freshVal;
                    }
                }
            }
            return target[key]
        }
    }) as any;
}
type TestTypeA = { typee: 'A', adata: number }
type TestTypeB = { typee: 'B', bData: { stuff: number } }
type TestTypeC = { typee: 'C', cData: string }
type TestCompound = TestTypeA | TestTypeB | TestTypeC
let arrToObjTest: ArrToObjHelper<[TestTypeA, TestTypeB], 'typee'>