"use client";
export function DangerSubmit({label,confirmText,className="dangerButton"}:{label:string;confirmText:string;className?:string}){return <button className={className} type="submit" onClick={e=>{if(!window.confirm(confirmText))e.preventDefault()}}>{label}</button>}
