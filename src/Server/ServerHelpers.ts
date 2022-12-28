export function mongoIdToString(id: any): string {
    switch (typeof id) {
        case 'string':
            return id;
        case 'object':
            if (typeof id['toHexString'] == 'function') {
                return id.toHexString();
            }
            default:
                console.log(id);
                debugger
                throw new Error(`Not ID`)
    }
}