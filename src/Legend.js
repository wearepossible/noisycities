import React from "react"
import { Button, Tooltip } from 'antd'
import { SoundOutlined } from '@ant-design/icons';

import GaugeChart from './charts/SoundGaugeChart/SoundGaugeChartComponent'
//import logo from './assets/Jetpack-small.png'

const legendStyle = {
  position: 'absolute',
  zIndex: 1,
  background: 'white',
  fontSize: 9,
  padding: 5,
  overflow: 'hidden',
  width: 250,
  height: 280,
  boxShadow: '2px 2px 4px #ccc',
  left: 20,
  bottom: 45,
  backgroundColor: '#ffffffdf',
  borderRadius: 2000
};


function Legend({ value, muted, setMuted }) {
  return (
    <div style={legendStyle}>
      <GaugeChart value={value} />
      <div style={{ textAlign: 'center', fontSize: 12 }}>ANNUAL AVERAGE<br/> NOISE INTENSITY (dB)</div>
      <div style={{ textAlign: 'center', position: 'absolute', top: 130, width: '100%', marginLeft: -5 }}>
        <Tooltip title={muted ? 'Unmute' : 'Mute'} placement="bottom">
          <Button style={{ opacity: muted ? 0.3 : 1 }} type={muted ? 'dashed' : 'default'} shape="circle" icon={<SoundOutlined />} onClick={() => setMuted(!muted)} />
        </Tooltip>
      </div>
    </div>
  )
}

export default Legend;