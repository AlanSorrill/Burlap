import { fColor } from "bristolboard";
import { isBrowser } from "./CommonImports";

export const ThickLogColor = {
    Black: 30,
    Red: 31,
    Green: 32,
    Yellow: 33,
    Blue: 34,
    Magenta: 35,
    Cyan: 36,
    White: 37,
    Reset: 0
}
export type ThickLogEncoded = {
    text: string | number | boolean | Object
    options?: ThickLogOptions
}
export type ThickLogOptions = {
    color?: keyof typeof ThickLogColor
    extra?: any 
    silentOverride?: boolean
    topic?: string
}
export const thickGlobals = {
    silent: false,
    encoded: false,
    censoredTopics: ['TSPipeSetData', 'DBS', 'TSPipe'] as string[]
}
export function thickCensor(topic: string){
    if(!thickGlobals.censoredTopics.includes(topic)){
        thickGlobals.censoredTopics.push(topic);
    }
}
export function thickUncensor(topic: string){
    thickGlobals.censoredTopics.removeInPlace((item)=>(item != topic))
}
if(typeof window != 'undefined'){
    window['thickGlobals'] = thickGlobals
    window['thickCensor'] = thickCensor
    window['thickUncensor'] = thickUncensor
}
export function thickColor(colorText: string){
    let bgColor: string;
    switch (colorText) {
        case 'Black':
            bgColor = fColor.black.toHexString();
            break;
        case 'Blue':
            bgColor = fColor.blue.base.toHexString();
            break;
        case 'Green':
            bgColor = fColor.green.base.toHexString();
            break;
        case 'Cyan':
            bgColor = fColor.cyan.base.toHexString();
            break;
        case 'Magenta':
            bgColor = fColor.purple.base.toHexString();
            break;
        case 'Red':
            bgColor = fColor.red.base.toHexString();
            break;
        default:
        case 'Reset':
            bgColor = fColor.white.toHexString();
            break;
        case 'White':
            bgColor = fColor.white.toHexString();
            break;
        case 'Yellow':
            bgColor = fColor.yellow.base.toHexString()
            break;
    }
    return bgColor;
}
export function stringifyNoCircles(input: Object): string{
    return JSON.stringify(input,stringifyNoCirclesReplacer())
}
export function stringifyNoCirclesReplacer() {
    let m = new Map(), v= new Map(), init = null;
  
    return function(field, value) {
      let p= m.get(this) + (Array.isArray(this) ? `[${field}]` : '.' + field); 
      let isComplex= value===Object(value)
      
      if (isComplex) m.set(value, p);  
      
      let pp = v.get(value)||'';
      let path = p.replace(/undefined\.\.?/,'');
      let val = pp ? `#REF:${pp[0]=='[' ? '$':'$.'}${pp}` : value;
      
      !init ? (init=value) : (val===init ? val="#REF:$" : 0);
      if(!pp && isComplex) v.set(value, path);
     
      return val;
    }
  }
export function thickLog(text: any, options: ThickLogOptions = { color: 'White' }) {
    if (thickGlobals.silent && !options.silentOverride) {
        return;
    }
    if(options.topic){
        for(let topic of thickGlobals.censoredTopics){
            if(topic == options.topic){
                return;
            }
        }
    }
    if (isBrowser()) {
        let bgColor: string = thickColor(options.color ? options.color : 'White');
        
        if (options.extra) {
            console.log(`%c${text}`, `color: ${bgColor}`, options.extra);
        } else {
            console.log(`%c${text}`, `color: ${bgColor}`);

        }
    } else {
        if(thickGlobals.encoded){
            
            console.log(`!~~!{"text": ${JSON.stringify(text,stringifyNoCirclesReplacer())}, "options": ${JSON.stringify(options,stringifyNoCirclesReplacer())}}`)
        } else if (options.extra) {
            console.log(`\u001b[${ThickLogColor[options.color ?? 'White']}m${text}\n\u001b[${ThickLogColor.White}m`, options.extra)
        } else {
            console.log(`\u001b[${ThickLogColor[options.color ?? 'White']}m${text}\n\u001b[${ThickLogColor.White}m`)
        }
    }
}