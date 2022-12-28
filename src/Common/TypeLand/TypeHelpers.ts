import { deCapitalizeFirstLetter, UnionToArray } from '../CommonImports'
export * from './CompoundTypes'
export type RemovePostfix<Str extends string, Postfix extends string> = Str extends `${infer A}${Postfix}` ? A : Str
export type ArrToObj<Arr extends unknown[], KeyField extends string, Out extends {} = {}> = Arr extends [infer SubType, ...infer Rest] ? (KeyField extends keyof SubType ? (ArrToObj<Rest, KeyField, Out & { [P in SubType[KeyField] & string]: SubType }>) : ArrToObj<Rest, KeyField, Out>) : Out

let testArrToObj: ArrToObj<UnionToArray<{type: 'a', info: string} | {type: 'b', data: number} | {type: 'c', isGood: boolean} | {dumb: 'stuff'} | never>,'type'>
 
export type ObjWithField<FieldName extends string | number | symbol, FieldValue> ={
    [P in FieldName]: FieldValue
} 

export type IntersectFields<Obj, AND> = {
    [P in (keyof Obj) & string]: Obj[P] & AND
}
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

type PathParentHelper<Path extends string, OutPath extends string> = Path extends `${infer A}.${infer B}` ? PathParentHelper<B, OutPath extends '' ? A : `${OutPath}.${A}`> : OutPath;

export type PathParent<Path extends string> = PathParentHelper<Path, ''>
type SubPathInto<T> = { [Prop in keyof T]: T[Prop] extends (string | number) ? `${Prop & string}` : (`${Prop & string}.${PathIntoHelper<T[Prop]>}`) | `${Prop & string}` }
type PathIntoHelper<T> = `${(SubPathInto<T>[keyof T] & string)}`

export type PathInto<T> = (PathIntoHelper<T> | '') & string
export type TypeFromPath<Target, Path> = Path extends '' ? Target : Path extends `${infer FirstItem}.${infer Rest}` ? TypeFromPath<Target[FirstItem & (keyof Target)], Rest> : Target[Path & keyof Target]
export function getFromPath<Target, Path extends PathInto<Target>>(target: Target, path: Path): TypeFromPath<Target, Path> {
    if (path == '') {
        return target as any;
    }
    let pathParts: string[] = path.split('.')
    let current: any = target;
    for (let i = 0; i < pathParts.length; i++) {
        current = current[pathParts[i]]
        if (typeof current == 'undefined' && i < pathParts.length - 1) {
            throw new Error(`Couldn't find ${path} in ${this.docPath}: ${pathParts[i]}`)
        }
    }

    return current as any;
}

export type ReadOnlySetters<T extends {}> = Readonly<T> & {
    [P in keyof T as `set${Capitalize<P & string>}`]: (fresh: T[P]) => void
}

export function readOnlySettersProxy<T extends {}>(t: T): ReadOnlySetters<T> {
    return new Proxy(t, {
        get(target, key) {
            if (typeof key == 'string') {
                if (key.startsWith('set')) {
                    let targetKey = deCapitalizeFirstLetter(key.substring(3))
                    console.log(`ReadOnlySetterProxy setting ${targetKey}`)
                    return (freshVal) => {
                        target[targetKey] = freshVal;
                    }
                }
            }
            return target[key]
        }
    }) as any;
}
export type TestTypeA = {_id: string, typee: 'A', adata: number }
export type TestTypeB = {_id: string, typee: 'B', bData: { stuff: number } }
export type TestTypeC = {_id: string, typee: 'C', cData: string }
export type TestTypeCompound = TestTypeA | TestTypeB | TestTypeC
let arrToObjTest: ArrToObj<[TestTypeA, TestTypeB], 'typee'>

export type ArrayToUnion<Arr extends unknown[], output = null> = Arr extends [infer first, ...infer rest] ? (output extends null ? ArrayToUnion<rest, first> : ArrayToUnion<rest, first & output>) : output

export type PathFlattenHelper2<DomainName extends string, InObj extends {}> = {
    [P in keyof InObj as `${DomainName}.${P & string}`]: InObj[P]
}
export type PathFlattenHelper3<IN> = IN extends [infer domainName, infer firstObj] ? (domainName extends string ? (firstObj extends Object ? PathFlattenHelper2<domainName, firstObj> : { msg: `Bad subDomain`, obj: firstObj }) : { msg: `Bad domain name`, name: domainName }) : { msg: `Bad entry`, in: IN }
// export type PathFlattenHelper<InObj extends unknown[], output extends unknown[] = []> =
//     InObj extends [infer start, infer rest] ? (rest extends unknown[] ? PathFlattenHelper<rest, [PathFlattenHelper3<start>,...output]> : [PathFlattenHelper3<[start,rest]>,...output]) : 
//     InObj extends [infer only] ? [PathFlattenHelper3<only>, ...output]
// (start extends [infer domainName, infer firstObj] ? (domainName extends string ? firstObj extends {} ? (rest extends unknown[] ? PathFlattenHelper<rest, [PathFlattenHelper2<domainName, firstObj>, ...output]> : {msg: `Bad rest`, rest: rest}) :
// { msg: `Bad input`, name: domainName, obj: firstObj } : { msg: `Bad domainName`, name: domainName })) : {out: output, rest: InObj}
export type PathFlattenObj<InObj extends {}> = ArrayToUnion<PathFlattenObjHelper1<ObjectToPairs<InObj>>>//PathFlattenHelper<ObjectToPairs<InObj>>
type PathFlattenObjHelper1<Pairs extends unknown[], output extends unknown[] = []> = Pairs extends [infer first, ...infer rest] ? PathFlattenObjHelper1<rest, [PathFlattenHelper3<first>, ...output]> : output
export type PathFlatten<InObj extends {}> = (keyof PathFlattenObj<InObj>)

export type StringifyWildcards<Str, output extends string = ''> = Str extends `${infer char}${infer rest}` ? (rest extends '' ? (char extends '*' ? `${output}${string}` : `${output}${char}`) : ((char extends '*' ? StringifyWildcards<rest, `${output}${string}`> : StringifyWildcards<rest, `${output}${char}`>))) : never//({msg: 'Bad string', str: Str})
export type RestarWildcards<Str extends string, pattern extends string, output extends string = ''> = Str extends `${infer strChar}${infer strRest}` ? (pattern extends `${infer patChar1}${infer patChar2}${infer patRest}` ? (strChar extends patChar1 ? RestarWildcards<strRest, `${patChar2}${patRest}`, `${output}${strChar}`> : (patChar1 extends '*' ? (patChar2 extends strChar ? RestarWildcards<strRest, `${patChar2}${patRest}`, `*${output}`> : RestarWildcards<strRest, `${patChar1}${patChar2}${patRest}`, output>) : 'naughty3')) : output) : 'naghty1'
type A = 'a' | 'aa' | 'aaa'
type B = 'bbb' | 'bb' | 'b'

type ObjectToPairs_Helper<Obj , RemainingKeys extends unknown[], output extends unknown[] = []> = RemainingKeys extends [infer First, ...infer Rest] ? (First extends keyof Obj ? ObjectToPairs_Helper<Obj, Rest, [[First, Obj[First]], ...output]> : [`Bad input`]) : output

export type ObjectToPairs<Obj , output extends unknown[] = []> = ObjectToPairs_Helper<Obj, UnionToArray<keyof Obj>>
export function getParentPath<Path extends PathInto<any>>(path: Path): PathParent<Path> {
    let parts = path.split('.')
    parts.splice(parts.length - 1, 1);
    return parts.join('.') as any
}

export type MatchesWildcard<Str extends string, Pattern extends string> = Str extends `${infer strFirst}${infer strRest}` ? (Pattern extends `${infer patFirst}${infer patSec}${infer patRest}` ? (patFirst extends '*' ? (patSec extends strFirst ? MatchesWildcard<strRest, patRest> : MatchesWildcard<strRest, `${patFirst}${patSec}${patRest}`>) :
    (strFirst extends patFirst ? MatchesWildcard<strRest, `${patSec}${patRest}`> : false)) : (Pattern extends `${infer finalPat}${infer restBat}` ? (finalPat extends strFirst ? (strRest extends '' ? true : false) : (finalPat extends '*' ? true : false)) : `Bad pattern ${Pattern}`)) : false
export function matchesWildcard<Str extends string, Pattern extends string>(str: Str, pattern: Pattern): MatchesWildcard<Str, Pattern> {
    let p = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] != pattern[p]) {
            if (pattern[p] == '*') {
                if (p < pattern.length - 1 && str[i] == pattern[p + 1]) {
                    p++;
                }
            } else {
                return false as any;
            }
        } else {
            p++;
        }
    }
    return true as any;
}
export function getWildcardField<Str extends string, Obj extends {}>(targetKey: string, obj: Object): MatchWildcardFieldNames<Str, Obj> {
    if (typeof obj[targetKey] != 'undefined') {
        return obj[targetKey]
    }
    for (let [key, value] of Object.entries(obj)) {
        if (matchesWildcard(targetKey, key)) {
            return value;
        }
    }
    return undefined as any;
}
let testMatchesPatern1: MatchesWildcard<'Stuff.things', 'Stuff.*'> = true
let testMatchesPatern2: MatchesWildcard<'Stuff.things', 'Stuff.things'> = true
let testMatchesPatern3: MatchesWildcard<'Stuff.thingss', 'Stuff.thing'> = false
let testMatchesPatern5: MatchesWildcard<'Stuff.thing', 'Stuff.things'> = false
let testMatchesPatern4: MatchesWildcard<'Stuff.things', '*.things'> = true
let testMatchesPatern6: MatchesWildcard<'WS_Stuff', 'WS_*'> = true
export type ContainsCharacter<Str extends string, Char extends string> = Str extends `${infer first}${infer rest}` ? (first extends Char ? true : ContainsCharacter<rest, Char>) : false
type MatchWildcardFieldNames_Helper<Str extends string, Pairs extends unknown[], defOutput = unknown> = Pairs extends [[infer firstKey, infer firstVal], ...infer rest] ? (firstKey extends string ? ((MatchesWildcard<Str, firstKey> extends true ? firstVal : MatchWildcardFieldNames_Helper<Str, rest, ContainsCharacter<firstKey, '*'> extends true ? firstVal : defOutput>)) : defOutput) : defOutput
export type MatchWildcardFieldNames<Str, Obj extends {}> = Str extends string ? MatchWildcardFieldNames_Helper<Str, ObjectToPairs<Obj>> : { msg: `Bad str`, str: Str }
let testMatchWildcardFieldNames: MatchWildcardFieldNames<'WS_stuff', { 'WS_*': { stuff: number }, 'doppioDb': { data: 'stuff' } }>
let testMatchWildcardFieldNames2: MatchWildcardFieldNames<'doppioDb', { 'WS_*': { stuff: number }, 'doppioDb': { data: 'stuff' } }>
let testMatchWild: MatchWildcardFieldNames_Helper<'WS_S', [['WS_*', { stuff: number }]]>