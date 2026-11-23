// Both lists are newest first. Groups use only already-authorized visible records.
export type GroupMessage = { author_id: string | null; created_at: string; reply_to_id?: string | null };
export type MessageGroupInfo = { start: boolean; end: boolean; dayStart: boolean };
export function messagePresentation(messages: GroupMessage[], index: number): MessageGroupInfo {
 const current=messages[index],older=messages[index+1],newer=messages[index-1];
 const day=(item:GroupMessage)=>{const date=new Date(item.created_at);return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;};
 function same(other:GroupMessage|undefined){return !!other&&!!current.author_id&&current.author_id===other.author_id&&!current.reply_to_id&&!other.reply_to_id&&day(current)===day(other)&&Math.abs(Date.parse(current.created_at)-Date.parse(other.created_at))<=5*60*1000;}
 return {start:!same(older),end:!same(newer),dayStart:!older||day(current)!==day(older)};
}
