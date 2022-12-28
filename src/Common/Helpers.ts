export function capitalizeFirstLetter(str: string) {
    return str[0].toUpperCase() + str.substring(1)
}
export function deCapitalizeFirstLetter(str: string) {
    return str[0].toLowerCase() + str.substring(1)
}

export function copyCombine<A extends {}, B extends {} | undefined>(a: A, b?: B): A & B {
    if(typeof b == undefined || b == null){
        return a as any;
    }
    let out: any = {}
    for (let [k, v] of Object.entries(a)) {
        out[k] = v;
    }
    for (let [k, v] of Object.entries(b as any)) {
        out[k] = v;
    }
    return out;
}
export function isBrowser(): boolean {
    if (typeof window == "undefined") {
        return false;
    }
    return true;
}
export class CallbackMap<CallbackParam>  {
    map: Map<string, Map<number, CallbackParam extends void ? () => void : (param: CallbackParam) => void>> = new Map();
    private idCounter = 0;
    private removeAfterNotify: boolean
    constructor(removeAfterNotify: boolean = false) {
        this.removeAfterNotify = removeAfterNotify
    }
    addCallback(key: string, callback: CallbackParam extends void ? () => void : (param: CallbackParam) => void) {
        let id = this.idCounter++;
        if (!this.map.has(key)) {
            let freshMap: Map<number, CallbackParam extends void ? () => void : (param: CallbackParam) => void> = new Map()
            freshMap.set(id, callback)
            this.map.set(key, freshMap)
        } else {
            this.map.get(key)?.set(id, callback)
        }
        return () => {
            this.map.get(key)?.delete(id)
        }
    }

    notify(eventKey: string, params?: CallbackParam) {
        // console.log(`Finding callbacks for ${eventKey}`)
        let ths = this;
        let notifyKey = (k) => {
            ths.map.get(k)?.forEach((callback, cancelid) => {
                callback(params as any)
                if (ths.removeAfterNotify) {
                    ths.map.get(k)?.delete(cancelid)
                }
            })
            // if (!vals) {
            //     throw new Error(`Can't find any callback for key ${k}`)
            // }
            // console.log(`Notifying ${k}`)
            // for (let callback of vals) {

            // }
        }
        for (let key of this.map.keys()) {
            if (key == eventKey) {
                notifyKey(key)
            }
            // console.log(`Checking  ${key}`)
            if (key.endsWith('.*')) {
                if (eventKey.startsWith(key.substring(0, key.length - 2))) {
                    notifyKey(key)

                }
            }
        }

    }

}