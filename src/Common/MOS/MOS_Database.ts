import { MOS_Collection, MOS_Database, MOS_Filter, MOS_Protocol, Sucket } from "../CommonImports";

export type MOS_ClientDB_Options<CollectionTypes extends {}> = {
    dbName: string
    filters: { [CollectionName in keyof CollectionTypes]: MOS_Filter<CollectionTypes[CollectionName]> }
    sorts: { [CollectionName in keyof CollectionTypes]?: MOS_Filter<CollectionTypes[CollectionName]> }
}
export function MOS_ClientDB<CollectionTypes extends {}>(options: MOS_ClientDB_Options<CollectionTypes>, sucket: Sucket<MOS_Protocol<CollectionTypes>>): MOS_Database<CollectionTypes> {
    let collections: MOS_Database<CollectionTypes> = {} as any;

    for (let [k, filter] of Object.entries(options.filters)) {
        let sort = options.sorts[k]
        collections[k] = MOS_Collection.Create({
            collectionId: {
                dbName: options.dbName,
                collectionName: k
            },
            filter: filter as any, sort: sort
        }, sucket);
    }
    return collections
}