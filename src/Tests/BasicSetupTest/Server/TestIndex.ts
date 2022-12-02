import { Burlap, DefaultProtocol, EventTemplate, ServerWebSucket } from "../../../Server/ServerImports";
import Path from 'path'
import express, { Express } from "express";
type MSG_Name = { type: 'nameReq', id: string } | { type: 'nameResp', name: string, meta?: number }

type MSG_FriendRequest = { type: 'friendRequestReq', from: string, to: string } | { type: 'friendRequestWaiting', successful: boolean } | { type: 'friendRequestAccepted', time: number }


type MSG = MSG_Name | MSG_FriendRequest

type SEVT_MovieRecomendation = EventTemplate<'movieRecomend', { genre: string }, { contentType: 'movie' | 'show', contentId: string, title: string, rating: number }>
type SEVT_NewFriend = EventTemplate<'newFriend', { userId: string }, { fromUserId: string, toUserId: string, time: number }>
type SEVT = SEVT_NewFriend | SEVT_MovieRecomendation

type TestProtocol = { reqRespTypes: MSG, eventTypes: {}, state: {} }
let rootPath = Path.join(__dirname.replace(`build${Path.sep}serverTsBuild`, 'src'), '..')
console.log(`RootDir ${rootPath}`)
let backend = Burlap.Create<TestProtocol>({
    port: 3000,
    initRouts: async (app) => {
        console.log(`Static serving at ${Path.join(rootPath, 'public')}`)
        app.use('/', express.static(Path.join(rootPath, 'public')))
    },
    sucketOptions: {
        reqRespListeners: {
            async onName(msg) {
                if (msg.id == '') {
                    return { type: 'Error', message: `No user id` }
                }
                return { name: 'silly', type: 'nameResp', meta: 2 }
            },
            async onFriendRequest(msg) {
                return { type: 'friendRequestAccepted', time: Date.now() }
            }
        },
        // eventPredicates: {

        // }
        eventPredicates: {
            // movieRecomend: (reg, packet) => (true),
            // newFriend: (reg, packet) => (true)
        },
        defaultState: () => ({})
    },
    webpackEntries: {
        lib: {
            import: ['react', 'react-dom']
        },
        clientBundle: {
            import: Path.join(rootPath, './Client/ClientIndex.tsx'),
            dependOn: 'lib'
        },
    }
}).then(async (burlap) => {
    let sucket = (burlap.suckets.get('') as ServerWebSucket<DefaultProtocol | TestProtocol>)
    // let ctrl = sucket.on('movieRecomend', {genre: 'fiction'}, (packet)=>{})
    let result = await sucket.send('friendRequest', { from: '', to: '' })
    switch (result.type) {
        case 'Error':
            break;
        case 'friendRequestAccepted':
            console.log(result.time);
            break;
        case 'friendRequestWaiting':
            console.log(result.successful)
    }
});

