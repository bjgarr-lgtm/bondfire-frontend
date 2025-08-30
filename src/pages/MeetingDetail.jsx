import React, { useState } from 'react'
import { getState, setState, fileToDataUrl } from '../../utils_store'
import { useParams, Link } from 'react-router-dom'

export default function MeetingDetail(){
  const { orgId, meetingId } = useParams()
  const s = getState()
  const [v,setV]=useState(0)
  const m = s.meetings.find(x=>x.id===meetingId)
  if(!m) return <div className="card">Not found</div>

  const onUpload = async (files) => {
    for (const f of files){
      const dataUrl = await fileToDataUrl(f)
      m.files.push({id:crypto.randomUUID(), name:f.name, size:f.size, mime:f.type, dataUrl})
    }
    setState(s); setV(v+1)
  }

  return (
    <div className="grid">
      <div className="row"><Link className="linkbtn" to={`/o/${orgId}/meetings`}>Back</Link></div>
      <div className="card">
        <h2>{m.title||'(untitled)'}</h2>
        <textarea value={m.notes} onChange={e=>{m.notes=e.target.value; setState(s); setV(v+1)}}/>
      </div>
      <div className="card">
        <h3>Files</h3>
        <input type="file" multiple onChange={e=>onUpload(e.target.files)} />
        <div className="list">
          {m.files?.map(f=>(
            <div key={f.id} className="row" style={{justifyContent:'space-between'}}>
              <div>{f.name} <span className="tag">{Math.round(f.size/1024)} KB</span></div>
              <a className="linkbtn" href={f.dataUrl} download={f.name}>Download</a>
            </div>
          ))}
          {!m.files?.length && <div className="tag">no files</div>}
        </div>
      </div>
    </div>
  )
}
