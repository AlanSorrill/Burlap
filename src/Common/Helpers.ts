export function capitalizeFirstLetter(str: string) {
    return str[0].toUpperCase() + str.substring(1)
}
export function deCapitalizeFirstLetter(str: string) {
    return str[0].toLowerCase() + str.substring(1)
}

export function copyCombine<A extends {}, B extends {}>(a: A, b: B): A & B {
    let out: any = {}
    for (let [k, v] of Object.entries(a)) {
        out[k] = v;
    }
    for (let [k, v] of Object.entries(b)) {
        out[k] = v;
    }
    return out;
}