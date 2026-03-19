import React, { useEffect, useState } from "react";

const STORAGE_KEY = "bf_drive_v2";

function parseLinks(text){
  return text.replace(/\[\[(.*?)\]\]/g, (_, t) => `<a href="#note:${t}">${t}</a>`);
}

export default function Drive(){
  const [notes,setNotes]=useState([]);
  const [current,setCurrent]=useState(null);
  const [content,setContent]=useState("");
  const [title,setTitle]=useState("");

  useEffect(()=>{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      setNotes(JSON.parse(raw));
    }
  },[]);

  useEffect(()=>{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  },[notes]);

  const createNote=()=>{
    const n={id:Date.now(), title:"untitled", body:""};
    setNotes([n,...notes]);
    setCurrent(n.id);
    setTitle("untitled");
    setContent("");
  };

  const selectNote=(id)=>{
    const n = notes.find(x=>x.id===id);
    if(!n) return;
    setCurrent(id);
    setTitle(n.title);
    setContent(n.body);
  };

  const save=()=>{
    setNotes(prev=>prev.map(n=>{
      if(n.id!==current) return n;
      return {...n, title, body:content};
    }));
  };

  useEffect(()=>{
    const t=setTimeout(save,500);
    return ()=>clearTimeout(t);
  },[content,title]);

  const backlinks = notes.filter(n=>n.body.includes(`[[${title}]]`));

  return (
    <div style={{display:"flex",height:"100vh"}}>
      <div style={{width:250,borderRight:"1px solid #333"}}>
        <button onClick={createNote}>+ Note</button>
        {notes.map(n=>(
          <div key={n.id} onClick={()=>selectNote(n.id)} style={{cursor:"pointer"}}>
            {n.title}
          </div>
        ))}
      </div>

      <div style={{flex:1,padding:12}}>
        {current && (
          <>
            <input value={title} onChange={e=>setTitle(e.target.value)} />
            <textarea value={content} onChange={e=>setContent(e.target.value)} style={{width:"100%",height:200}} />

            <div dangerouslySetInnerHTML={{__html:parseLinks(content)}} />

            <h4>Backlinks</h4>
            {backlinks.map(b=><div key={b.id}>{b.title}</div>)}
          </>
        )}
      </div>
    </div>
  );
}
