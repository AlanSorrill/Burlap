export type IsValidatable<T> = T extends Array<infer subType> ? IsValidatable<subType> :
    T extends number ? true :
    T extends string ? true :
    T extends boolean ? true :
    T extends symbol ? true :
    false

export type ValidatableKeys<T> = {
    [P in keyof T]: IsValidatable<T[P]> extends true ? P : never
}[keyof T & string]