import { EventTemplate } from "./CommonImports"

export type MSG_Error = {type: 'Error', message: string}

export type SEVT_WebpackBuildUpdate = EventTemplate<'webpackBuildUpdate',{},{progress: number, message: string, extra: string[]}>

export type DefaultProtocol = { reqRespTypes: MSG_Error, eventTypes: SEVT_WebpackBuildUpdate, state: {} }