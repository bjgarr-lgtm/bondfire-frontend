import React, { useState } from 'react'
import { getState, setState } from '../../utils_store'
import { useParams, Link } from 'react-router-dom'

export default function NeedDetail(){
  const { orgId, needId } = useParams()
  const s = getState()
  const [v, setV] = useState(0)
  const n = s.needs.find(x=>x.id===needId)
  if(!n) return <div className="card">Not found</div>
  return (
    <div className="grid">
      <div className="row">
        <Link className="linkbtn" to={`/o/${orgId}/needs`}>Back</Link>
      </div>
      <div className="card">
        <h2>Need Detail</h2>
        <div className="grid">
          <input value={n.title} onChange={e=>{n.title=e.target.value; setState(s); setV(v+1)}}/>
          <textarea value={n.notes} onChange={e=>{n.notes=e.target.value; setState(s); setV(v+1)}}/>
        </div>
      </div>
    </div>
  )
}
