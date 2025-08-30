import React, { useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader.jsx'
import { useStore, addPledge, addNewsletterEmail } from '../utils/store.js'

export default function Public(){
  const { inventory, needs } = useStore(s=>({inventory:s.inventory, needs:s.needs}))
  const [q, setQ] = useState('')
  const items = useMemo(()=>inventory.filter(i => i.public && (i.name?.toLowerCase().includes(q.toLowerCase()) || i.category?.toLowerCase().includes(q.toLowerCase()))), [inventory,q])

  function pledge(e){
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    addPledge({ name:form.get('name'), contact:form.get('contact'), message:form.get('message') })
    e.currentTarget.reset()
    alert('Thanks — we saved your pledge.')
  }

  function signup(e){
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = form.get('email')
    if(email) addNewsletterEmail(email)
    e.currentTarget.reset()
    alert('You are on the list.')
  }

  return (
    <div>
      <AppHeader />
      <div className="grid cols-3" style={{padding:'16px'}}>
        <section className="card">
          <h2 className="section-title">Inventory</h2>
          <input className="input" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          <ul style={{marginTop:10, paddingLeft:16}}>
            {items.map(i => <li key={i.id}>{i.name} — {i.qty} {i.unit}</li>)}
          </ul>
        </section>
        <section className="card">
          <h2 className="section-title">Open Needs</h2>
          <ul style={{margin:0, paddingLeft:16}}>
            {needs.filter(n=>n.status!=='resolved').map(n => <li key={n.id}><strong>{n.title}</strong> — {n.status}</li>)}
          </ul>
          <details style={{marginTop:12}}>
            <summary className="section-title" style={{fontSize:16}}>I can help</summary>
            <form onSubmit={pledge} className="grid">
              <input className="input" name="name" placeholder="Your name" required/>
              <input className="input" name="contact" placeholder="Email or phone" required/>
              <textarea className="textarea" name="message" placeholder="How you can help" />
              <button className="btn">Send</button>
            </form>
          </details>
        </section>
        <section className="card">
          <h2 className="section-title">Stay in touch</h2>
          <form onSubmit={signup} className="grid">
            <input className="input" name="email" type="email" placeholder="email@domain" required/>
            <button className="btn">Join Newsletter</button>
          </form>
          <details style={{marginTop:12}}>
            <summary className="section-title" style={{fontSize:16}}>Request help</summary>
            <p>Use admin to publish requests publicly; public/private visibility is respected.</p>
          </details>
        </section>
      </div>
    </div>
  )
}
