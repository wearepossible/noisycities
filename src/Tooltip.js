import React from "react"

const tooltipStyle = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 1,
  background: 'white',
  fontSize: 9,
  padding: 5,
  overflow: 'hidden',
  width: 90,
  borderRadius: 200,
  boxShadow: '2px 2px 4px #ccc',
};


function Tooltip({ data }) {
  if(!data) return null;
  const { color, x, y } = data;
  return (
    <div
        style={{
          width: 300,
          ...tooltipStyle,
          left: x + 0,
          top: y + 0,
        }}
      >
        <div style={{ width: 80, height: 80, backgroundColor: color, borderRadius: 200 }}>
        </div>
      </div>
  )
}

export default Tooltip;