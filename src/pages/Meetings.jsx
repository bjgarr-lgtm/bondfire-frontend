import React, { useState } from 'react'
import UploadPreview from '../components/UploadPreview.jsx'
import { useStore, addMeeting, updateMeeting, saveFile, attachFileToMeeting } from '../utils/store.js'

export default function Meetings(){
  const meetings = useStore(s=>s.meetings)
  const files = useStore(s=>s.files)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')

  async function onUpload(e, id){
    const file = e.target.files?.[0]
    if(!file) return
    const fileId = await saveFile(file)
    attachFileToMeeting(id, fileId)
    e.target.value = ''
  }
  function onAdd(e){
    e.preventDefault()
    addMeeting({ title, when, notes:'' })
    setTitle(''); setWhen('')
  }

  return (
    <div>
      <div className="card" style={{margin:16}}>
        <h2 className="section-title">Meetings</h2>
        <form onSubmit={onAdd} className="grid cols-3">
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" required/>
          <input className="input" value={when} onChange={e=>setWhen(e.target.value)} placeholder="When"/>
          <button className="btn">Add Meeting</button>
        </form>
        <div className="grid" style={{marginTop:12}}>
          {meetings.map(m=> (
            <div className="card" key={m.id}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
                <input className="input" defaultValue={m.title} onBlur={e=>updateMeeting(m.id,{title:e.target.value})}/>
                <input className="input" defaultValue={m.when} onBlur={e=>updateMeeting(m.id,{when:e.target.value})}/>
                <label className="btn" style={{display:'inline-block'}}>
                  Upload file
                  <input type="file" style={{display:'none'}} onChange={(e)=>onUpload(e,m.id)} />
                </label>
              </div>
              {m.files?.length > 0 && (
                <div className="grid" style={{marginTop:10}}>
                  {m.files.map(fid => <UploadPreview key={fid} file={files[fid]} />)}
                </div>
              )}
              <textarea className="textarea" style={{marginTop:10}} defaultValue={m.notes} onBlur={e=>updateMeeting(m.id,{notes:e.target.value})}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
