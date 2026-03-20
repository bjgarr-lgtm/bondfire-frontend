import React from "react";

function Btn({ children, onClick, title }) {
  return (
    <button className="btn" type="button" onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export default function RichTextToolbar({
  onBold,
  onItalic,
  onH1,
  onH2,
  onBullet,
  onQuote,
  onCode,
  onRule,
  onLink,
  onWikiLink,
}) {
  return (
    <div className="card" style={{ padding: 10, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Btn onClick={onBold} title="Bold">B</Btn>
      <Btn onClick={onItalic} title="Italic"><i>I</i></Btn>
      <Btn onClick={onH1} title="Heading 1">H1</Btn>
      <Btn onClick={onH2} title="Heading 2">H2</Btn>
      <Btn onClick={onBullet} title="Bullet list">• List</Btn>
      <Btn onClick={onQuote} title="Quote">❝ Quote</Btn>
      <Btn onClick={onCode} title="Inline code">{`</>`}</Btn>
      <Btn onClick={onLink} title="Link">Link</Btn>
      <Btn onClick={onWikiLink} title="Wiki link">[[Note]]</Btn>
      <Btn onClick={onRule} title="Horizontal rule">―</Btn>
    </div>
  );
}