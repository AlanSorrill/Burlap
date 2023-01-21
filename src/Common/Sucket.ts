import { PathInto, ArrToObj, copyCombine, FieldsNotEndingWith, FieldsStartingWith, FieldsToUnion, KeysEndingWith_ReturnPrefix, MSG_Error, RemoveNevers, UnionToArray, UnionToIntersection, TypeFromPath } from "./CommonImports"

export type Protocol_GetReqNames<Protocol extends SucketProtocol> = KeysEndingWith_ReturnPrefix<ArrToObj<UnionToArray<Protocol['reqRespTypes']>, 'type'>, 'Req'> & string
export type Protocol_GetReqObj<Protocol extends SucketProtocol, MsgName extends Protocol_GetReqNames<SucketProtocol>> = `${MsgName & string}Req` extends keyof ArrToObj<UnionToArray<Protocol['reqRespTypes']>, 'type'> ? ArrToObj<UnionToArray<Protocol['reqRespTypes']>, 'type'>[`${MsgName & string}Req`] : false
export type Protocol_GetRespObj<Protocol extends SucketProtocol, MsgName extends Protocol_GetReqNames<SucketProtocol>> = FieldsToUnion<FieldsNotEndingWith<FieldsStartingWith<ArrToObj<UnionToArray<Protocol['reqRespTypes']>, 'type'>, MsgName & string>, 'Req'>> | MSG_Error

export type Protocol_GetEventNames<Protocol extends SucketProtocol> = (keyof ArrToObj<UnionToArray<Protocol['eventTypes']>, 'type'>) & string
export type Protocol_GetEventTemplate<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = ArrToObj<UnionToArray<Protocol['eventTypes']>, 'type'>[EventName]
export type Protocol_GetEventPacketObj<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = Protocol_GetEventTemplate<Protocol, EventName> extends EventTemplate<EventName, infer regObj, infer packetObj> ? packetObj : false
export type Protocol_GetEventRegObj<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = Protocol_GetEventTemplate<Protocol, EventName> extends EventTemplate<EventName, infer regObj, infer packetObj> ? regObj : false
export type Protocol_GetEventHandle<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = Protocol_GetEventTemplate<Protocol, EventName> extends EventTemplate<EventName, infer regObj, infer packetObj> ? EventHandle<Protocol_GetEventTemplate<Protocol, EventName>> : false
export type Protocol_GetState<Protocol extends SucketProtocol> = UnionToIntersection<Protocol['state']>

export type SVET_Packet<Event extends EventTemplate<string, any, any>> = Event extends EventTemplate<string, any, infer Packet> ? Packet : 'Not Event'

export type EventHandle<EVT extends EventTemplate<string, {}, {}>> = EVT extends EventTemplate<infer name, infer reg, infer packet> ? {
    cancel: () => void,
    updateRegistration: (edit: Partial<reg>) => Promise<boolean>
} : 'Not event'




export type SucketProtocol = {
    reqRespTypes: unknown,
    eventTypes: unknown,
    state: {}
}

export type UnionFields<A, B> = {
    [P in keyof A]: P extends keyof B ? A[P] | B[P] : never
}

// export function CombineProtocols<A extends SucketProtocol, B extends SucketProtocol>(a: ServerSucketOptions<A>, b: ServerSucketOptions<B>): ServerSucketOptions<A | B> {
export function CombineProtocols(a, b): any {

    let out: any = {}
    for (let [k, v] of Object.entries(a)) {
        if (typeof a[k] == 'object' && typeof b[k] == 'object') {

            out[k] = copyCombine(a[k], b[k]);


        } else if (typeof a[k] != 'undefined' && typeof b[k] == 'undefined') {
            out[k] = a[k]
        } else if (typeof a[k] == 'undefined' && typeof b[k] != 'undefined') {
            out[k] = b[k]
        } else {
            if (Array.isArray(a[k]) && Array.isArray(b[k])) {
                out[k] = (a[k] as unknown[]).concat(b[k])
            } else if (Array.isArray(a[k])) {
                out[k] = a[k];
                (out[k] as unknown[]).push(b[k]);
            } else if (Array.isArray(b[k])) {
                out[k] = b[k];
                (out[k] as unknown[]).push(b[k]);
            } else {
                out[k] = [a[k], b[k]]
            }

        }
    }
    return out;
}

export type EventTemplate<EventName extends string, RegObject extends {}, PacketObject extends {}> = {
    type: EventName
    registration: RegObject,
    packet: PacketObject
}
export function isSucketStateArraySetter<T>(v: Object): v is SucketStateArraySetterValue<T>{
    if(typeof v != 'object'){
        return false;
    }
    if(Array.isArray(v)){
        return false;
    }
    if(typeof v['$filter'] == 'function'){
        return true;
    }
    if(typeof v['$push'] != 'undefined'){
        return true;
    }
    return false;
}
export type SucketStateArraySetterValue<T> = ({$push: T} | {$filter: (v: T)=>boolean})
export type SucketStateSetter<Protocol extends SucketProtocol> = (fresh: Partial<{ [P in Exclude<PathInto<Protocol_GetState<Protocol>>,''>]: TypeFromPath<Protocol_GetState<Protocol>, P> extends Array<infer sub> ? sub[] | SucketStateArraySetterValue<sub> : TypeFromPath<Protocol_GetState<Protocol>, P> }>) => void;
type SucketReqRespListenerHelper<MsgTypeDecompound extends {}, Protocol extends SucketProtocol, Side extends 'server' | 'client'> = {
    // [P in KeysEndingWith<MsgTypeDecompound,'Req'> as `on${Capitalize<P>}Request`]: `${P}Resp` extends keyof MsgTypeDecompound ? ()=>(Promise<MsgTypeDecompound[`${P}Resp`]>) : 'No Response Type'
    [P in keyof MsgTypeDecompound as P extends `${infer prefixName}Req` ? `on${Capitalize<prefixName>}` : never]:
    P extends `${infer prefix}Req` ? (Side extends 'server' ? (((msg: MsgTypeDecompound[P], state: Readonly<Protocol_GetState<Protocol>>, setState: SucketStateSetter<Protocol>) => (Promise<MSG_Error | FieldsToUnion<FieldsNotEndingWith<FieldsStartingWith<MsgTypeDecompound, prefix>, 'Req'>>>))) : (((msg: MsgTypeDecompound[P]) => (Promise<MSG_Error | FieldsToUnion<FieldsNotEndingWith<FieldsStartingWith<MsgTypeDecompound, prefix>, 'Req'>>>)))) : never
}
export type ServerSucketReqRespListener<Protocol extends SucketProtocol> = RemoveNevers<SucketReqRespListenerHelper<ArrToObj<UnionToArray<Protocol['reqRespTypes']>, 'type'>, Protocol, 'server'>>
export type ClientSucketReqRespListener<Protocol extends SucketProtocol> = RemoveNevers<SucketReqRespListenerHelper<ArrToObj<UnionToArray<Protocol['reqRespTypes']>, 'type'>, Protocol, 'client'>>

export type EventRegistration<EventName extends string, RegObject extends {}> = RegObject & { eventName: EventName, _id: string }

type SucketEventPredicateHelper<EventTemplatesDecompound extends {}, Protocol extends SucketProtocol> = {
    [P in keyof EventTemplatesDecompound]: EventTemplatesDecompound[P] extends EventTemplate<infer eventName, infer regObj, infer packetObj> ? ((reg: EventRegistration<eventName, regObj>, packet: packetObj, state: Protocol_GetState<Protocol>) => (boolean)) :
    'bad'
}

export type SucketEventPredicate<Protocol extends SucketProtocol> = RemoveNevers<SucketEventPredicateHelper<ArrToObj<UnionToArray<Protocol['eventTypes']>, 'type'>, Protocol>>


export type ClientSucketOptions<Protocol extends SucketProtocol> = {
    reqRespListeners: Partial<ClientSucketReqRespListener<Protocol>>

}
export type ServerSucketOptions<Protocol extends SucketProtocol> = {
    reqRespListeners: ServerSucketReqRespListener<Protocol>
    eventPredicates: SucketEventPredicate<Protocol>
    defaultState: (() => Protocol_GetState<Protocol>) | Array<() => Protocol_GetState<Protocol>>
}
export type SuckMSG_ReqRespRequest<Protocol extends SucketProtocol> = {
    suckType: 'reqResReq'

    message: Protocol['reqRespTypes']
}
export type SuckMSG_ReqRespResponse<Protocol extends SucketProtocol> = {
    suckType: 'reqResResp',
    transactionId: string
    message: Protocol['reqRespTypes']
}
export type SuckMSG_EventRegister_Req<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = {
    suckType: 'eventRegisterRequestReq',
    eventName: EventName
    regObject: Protocol_GetEventRegObj<Protocol, EventName>
}
export type SuckMSG_EventRegister_Succ = {
    suckType: 'eventRegisterRequestResp',
    success: true,
    evtRegId: string
}
export type SuckMSG_EventRegister_Fail = {
    suckType: 'eventRegisterRequestResp',
    success: false
}
export type SuckMSG_EventUpdateReg_Req<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = {
    suckType: 'eventUpdateRegReq',
    evtRegId: string,
    eventName: EventName,
    regObject: Partial<Protocol_GetEventRegObj<Protocol, EventName>>
}
export type SuckMSG_EventUpdateReg_Resp = {
    suckType: 'eventUpdateRegResp',
    success: boolean
}
export type SuckMSG_EventPacket<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = {
    suckType: 'eventPacket',
    rejIds: string[]
    message: Protocol_GetEventPacketObj<Protocol, EventName>
}
export type SuckMSG_EventCancel<Protocol extends SucketProtocol, EventName extends Protocol_GetEventNames<Protocol>> = {
    suckType: 'eventCancel',
    evtRegId: string
    eventName: EventName
}
// export type Sucket_CallbackRegistrator<Protocol extends SucketProtocol> = (<EventName extends Protocol_GetEventNames<Protocol>>(eventName: EventName, callback: (packet: Protocol_GetEventPacketObj<Protocol, EventName>) => void) => (Protocol_GetEventHandle<Protocol, EventName>))

export type SuckMSG<Protocol extends SucketProtocol> = (SuckMSG_EventCancel<Protocol, Protocol_GetEventNames<Protocol>> | SuckMSG_EventPacket<Protocol, Protocol_GetEventNames<Protocol>> | SuckMSG_EventUpdateReg_Resp | SuckMSG_EventUpdateReg_Req<Protocol, Protocol_GetEventNames<Protocol>> | SuckMSG_EventRegister_Req<Protocol, Protocol_GetEventNames<Protocol>> | SuckMSG_EventRegister_Succ | SuckMSG_EventRegister_Fail | SuckMSG_ReqRespRequest<Protocol> | SuckMSG_ReqRespResponse<Protocol>)
export type TransactionId<T extends {}> = T & { transactionId: string }
export type SucketLifecycleEvent = {
    connect: {},
    disconnect: { code: number, reason: string }
}

export abstract class Sucket<Protocol extends SucketProtocol> {
    // options: SucketOptions<Protocol>
    constructor() {
        // this.options = options;

        // this.on = this.on.bind(this);
        // this.sendMessage = this.sendMessage.bind(this);
    }

    // on: Sucket_CallbackRegistrator<Protocol> = ((evtName, callback) => {
    //     let ths = this as Sucket<Protocol>
    //     return {}
    // }) as any;
    reqRespWaiters: Map<string, (value: Protocol_GetRespObj<Protocol, Protocol_GetReqNames<Protocol> & string>) => void> = new Map();

    send<MsgType extends Protocol_GetReqNames<Protocol>, RespType extends Protocol_GetRespObj<Protocol, MsgType> = Protocol_GetRespObj<Protocol, MsgType>>(msgType: MsgType, msg: Omit<Protocol_GetReqObj<Protocol, MsgType>, 'type'>): Promise<RespType> {
        return new Promise((acc) => {
            msg['type'] = `${msgType}Req`;
            let tid = this.sendSuckMsg({ suckType: 'reqResReq', message: msg })
            this.reqRespWaiters.set(tid, acc as any)

        })
    }



    onLifecycle<EventName extends keyof SucketLifecycleEvent>(eventName: EventName, callback: (evt: SucketLifecycleEvent[EventName]) => void): (() => void) {
        let subMap = this.lifecycleListeners.get(eventName)
        if (!subMap) {
            subMap = new Map()
            this.lifecycleListeners.set(eventName, subMap)
        }
        let id = this.lifecycleListenerCounter++;
        subMap.set(id, callback as any);
        return () => {
            subMap?.delete(id);
        }
    }
    private lifecycleListenerCounter = 0;
    private lifecycleListeners: Map<keyof SucketLifecycleEvent, Map<number, (evt: SucketLifecycleEvent[keyof SucketLifecycleEvent]) => void>> = new Map();
    protected emitLifecycleEvent<EventName extends keyof SucketLifecycleEvent>(eventName: EventName, event: SucketLifecycleEvent[EventName]) {
        if (this.lifecycleListeners.has(eventName)) {
            this.lifecycleListeners.get(eventName)?.forEach((cb) => { cb(event) })
        }
    }


    // private reqResWaiters: Map<string, (resp: Protocol["reqRespTypes"] | MSG_Error) => void> = new Map();
    // private reqResCount = 0;
    // sendMessage: Sucket_SendMessage<Protocol> = (async <MessageTypeName extends Protocol_GetReqNames<Protocol>>(typeName:  MessageTypeName, msg:  Omit<Protocol_GetReqObj<Protocol, MessageTypeName>, 'type'>)=>{
    //     let ths = this as Sucket<Protocol>
    //     return new Promise<Protocol_GetRespObj<Protocol, MessageTypeName>>((acc)=>{
    //         msg['type'] = typeName;
    //         let suckMsg: SuckMSG_ReqRespRequest<Protocol> = {
    //             suckType: 'reqResReq',
    //             transactionId: `${ths.reqResCount++}`,
    //             message: msg
    //         }
    //         ths.reqResWaiters.set(suckMsg.transactionId,(resp)=>{
    //             ths.reqResWaiters.delete(suckMsg.transactionId);
    //             acc(resp as any);
    //         });
    //     })

    // }) as any


    protected abstract _sendSuckMsg(msg: TransactionId<SuckMSG<Protocol>>): void

    private transIdCounter = 0;
    protected sendSuckMsg(msg: SuckMSG<Protocol> | (TransactionId<SuckMSG<Protocol>>))//: Promise<MSG extends TransactionId<infer sub> ? void : (msgg: SuckMSG<Protocol>) => {}> 
    {
        let ths = this;
        // return new Promise((acc) => {
        let out: TransactionId<SuckMSG<Protocol>> = msg as any;

        if (typeof out.transactionId == 'undefined') {
            out.transactionId = `${ths.transIdCounter++}${Date.now()}`

        }
        ths._sendSuckMsg(out)
        return out.transactionId;
        // if (expectResponse) {
        //     this.suckRoundTripWaiters.set(out.transactionId, acc as any);
        // } else {
        //     acc(undefined as any);
        // }
        // acc(undefined as any)
        // })
    }
    protected async sendSuckMsgRoundTrip(msg: SuckMSG<Protocol>) {
        let ths = this;
        return new Promise<SuckMSG<Protocol>>((acc) => {
            let tid = ths.sendSuckMsg(msg);
            ths.suckRoundTripWaiters.set(tid, acc);
        })
    }

    protected suckRoundTripWaiters: Map<string, (msg: SuckMSG<Protocol>) => void> = new Map();

    protected abstract onSuckMsg(msg: TransactionId<SuckMSG<Protocol>>): Promise<void>;
    async handleSuckMsg(msg: TransactionId<SuckMSG<Protocol>>) {
        if (this.suckRoundTripWaiters.has(msg.transactionId)) {
            this.suckRoundTripWaiters.get(msg.transactionId)?.(msg);
            this.suckRoundTripWaiters.delete(msg.transactionId);
            return;
        }
        switch (msg.suckType) {


            case 'reqResResp':
                let waiter = this.reqRespWaiters.get(msg.transactionId);
                if (!waiter) {
                    throw new Error(`Got response for unregistered request ${msg.transactionId}`)
                }
                waiter(msg.message as any);
                return;

            default:
                return this.onSuckMsg(msg);
        }
    }
}