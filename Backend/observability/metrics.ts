type Labels = Record<string,string>;
const counters = new Map<string,Map<string,{labels:Labels,value:number}>>();
const defs = new Map<string,{type:"counter"|"histogram";help:string;buckets?:number[]}>();
const histograms = new Map<string,Map<string,{labels:Labels,count:number,sum:number,buckets:number[]}>>();
const key=(l:Labels)=>JSON.stringify(Object.entries(l).sort());
const esc=(v:string)=>v.replaceAll("\\","\\\\").replaceAll('"','\\"');
const renderLabels=(l:Labels)=>{const s=Object.entries(l).sort().map(([k,v])=>`${k}="${esc(v)}"`).join(",");return s?`{${s}}`:"";};
export const defineCounter=(name:string,help:string)=>{if(defs.has(name))return;defs.set(name,{type:"counter",help});counters.set(name,new Map());};
export const defineHistogram=(name:string,help:string,buckets:number[])=>{if(defs.has(name))return;const b=[...new Set(buckets.filter(Number.isFinite))].sort((a,b)=>a-b);defs.set(name,{type:"histogram",help,buckets:b});histograms.set(name,new Map());};
export const incrementCounter=(name:string,labels:Labels={},amount=1)=>{const s=counters.get(name);if(!s||amount<=0)return;const k=key(labels),x=s.get(k);if(x)x.value+=amount;else s.set(k,{labels:{...labels},value:amount});};
export const observeHistogram=(name:string,value:number,labels:Labels={})=>{const d=defs.get(name),s=histograms.get(name);if(!d||d.type!=="histogram"||!s||!Number.isFinite(value)||value<0)return;const k=key(labels),x=s.get(k)??{labels:{...labels},count:0,sum:0,buckets:d.buckets!.map(()=>0)};x.count++;x.sum+=value;d.buckets!.forEach((b,i)=>{if(value<=b)x.buckets[i]++;});s.set(k,x);};
export const resetMetrics=()=>{counters.forEach(s=>s.clear());histograms.forEach(s=>s.clear());};
let outbox={pending:0,processing:0,oldestPendingAgeSeconds:0};
export const setOutboxGaugeSnapshot=(pending:number,processing:number,oldestPendingAgeSeconds:number)=>{outbox={pending:Math.max(0,Math.floor(pending)),processing:Math.max(0,Math.floor(processing)),oldestPendingAgeSeconds:Math.max(0,oldestPendingAgeSeconds)};};
export const renderOutboxGauges=()=>`# HELP outbox_pending_events Pending outbox events.\n# TYPE outbox_pending_events gauge\noutbox_pending_events ${outbox.pending}\n# HELP outbox_processing_events Outbox events currently processing.\n# TYPE outbox_processing_events gauge\noutbox_processing_events ${outbox.processing}\n# HELP outbox_oldest_pending_age_seconds Age of the oldest pending outbox event.\n# TYPE outbox_oldest_pending_age_seconds gauge\noutbox_oldest_pending_age_seconds ${outbox.oldestPendingAgeSeconds}\n`;
export const renderMetrics=()=>{const lines:string[]=[];for(const [n,d] of defs){lines.push(`# HELP ${n} ${d.help}`,`# TYPE ${n} ${d.type}`);if(d.type==="counter"){for(const x of counters.get(n)!.values())lines.push(`${n}${renderLabels(x.labels)} ${x.value}`);}else{for(const x of histograms.get(n)!.values()){d.buckets!.forEach((b,i)=>lines.push(`${n}_bucket${renderLabels({...x.labels,le:String(b)})} ${x.buckets[i]}`));lines.push(`${n}_bucket${renderLabels({...x.labels,le:"+Inf"})} ${x.count}`);lines.push(`${n}_sum${renderLabels(x.labels)} ${x.sum}`,`${n}_count${renderLabels(x.labels)} ${x.count}`);}}}return lines.join("\n")+"\n";};
[
["http_requests_total","Total completed HTTP requests."],["http_errors_total","Total HTTP server errors."],
["auth_login_success_total","Successful password logins."],["auth_login_failure_total","Failed password logins."],
["messages_created_total","Persisted chat messages."],["message_send_failures_total","Message creation failures."],
["db_operation_errors_total","Database operation failures."],["socket_connections_total","Socket connections established."],
["socket_disconnects_total","Socket disconnects."],["socket_auth_failures_total","Rejected socket authentication attempts."],["socket_reconnects_total","Socket reconnects observed by the server."],
["redis_errors_total","Redis operation failures."],["kafka_publish_total","Kafka publication attempts."],["kafka_publish_failures_total","Kafka publication failures."],
["kafka_consume_total","Kafka events processed."],["kafka_consume_failures_total","Kafka consumer failures."],["kafka_duplicate_events_total","Duplicate Kafka events ignored."],
["outbox_published_total","Outbox events published."],["outbox_retry_total","Outbox retries scheduled."],["outbox_dead_lettered_total","Outbox events dead-lettered."]
].forEach(([n,h])=>defineCounter(n,h));
defineHistogram("http_request_duration_seconds","HTTP request duration.",[.005,.01,.025,.05,.1,.25,.5,1,2,5]);
defineHistogram("db_operation_duration_seconds","Database operation duration.",[.005,.01,.025,.05,.1,.25,.5,1,2,5]);
defineHistogram("outbox_publication_duration_seconds","Outbox publication duration.",[.005,.01,.025,.05,.1,.25,.5,1,2,5]);
export const metricsContentType="text/plain; version=0.0.4; charset=utf-8";
