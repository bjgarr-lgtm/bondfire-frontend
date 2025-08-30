import React, { useMemo, useState } from 'react'
import { useStore, addPerson, updatePerson, deletePerson } from '../utils/store.js'

export default function People(){
  const people = useStore(s=>s.people)
  const [q,setQ]=useState('')
  const list = useMemo(()=>people.filter(p=>[p.name,p.role,p.skills].join(' ').toLowerCase().includes(q.toLowerCase())),[people,q])
  function onAdd(e){
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    addPerson({ name:f.get('name'), role:f.get('role'), phone:f.get('phone'), skills:f.get('skills') })
    e.currentTarget.reset()
  }
  return (
    <div>
      <div className="card" style={{margin:16}}>
        <h2 className="section-title">People</h2>
        <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, role, skills"/>
        <table className="table" style={{marginTop:12}}>
          <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Skills</th><th/></tr></thead>
          <tbody>
            {list.map(p=>(
              <tr key={p.id}>
                <td><input className="input" defaultValue={p.name} onBlur={e=>updatePerson(p.id,{name:e.target.value})}/></td>
                <td><input className="input" defaultValue={p.role} onBlur={e=>updatePerson(p.id,{role:e.target.value})}/></td>
                <td><input className="input" defaultValue={p.phone} onBlur={e=>updatePerson(p.id,{phone:e.target.value})}/></td>
                <td><input className="input" defaultValue={p.skills} onBlur={e=>updatePerson(p.id,{skills:e.target.value})}/></td>
                <td><button className="btn" onClick={()=>deletePerson(p.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={onAdd} className="grid cols-3" style={{marginTop:12}}>
          <input className="input" name="name" placeholder="Name" required/>
          <input className="input" name="role" placeholder="Role"/>
          <input className="input" name="phone" placeholder="Phone"/>
          <input className="input" name="skills" placeholder="Skills" />
          <div></div><div></div>
          <button className="btn">Add Person</button>
        </form>
      </div>
    </div>
  )
}
