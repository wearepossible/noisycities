import React from "react"

import logo from './assets/Jetpack-small.png'
import possibleLogo from './assets/Possible_Logo_WebsiteLogo.jpeg'
import { Row, Tabs } from 'antd'

function Panel({setCity, city, intro, sources}) {
  return (
    <div>
      <img src={possibleLogo} alt="possible logo" style={{width: '100%'}} />
      <h1 style={{ textAlign: 'center', fontWeight: 'bold', color: '#bc0978'}}>Inspiring climate action</h1>
      {intro}
      {sources}
      <Row style={{ fontFamily: 'Poppins, sans-serif', textShadow: 'none'}} align="middle">
        <div style={{ marginRight: 32, fontSize: 16 }}>Pick a city: </div>
        <Tabs onChange={setCity} activeKey={city}>
          <Tabs.TabPane tab="Paris" key="paris" />
          <Tabs.TabPane tab="Brussels" key="bxl" />
          <Tabs.TabPane tab="New-York City" key="nyc" />
          <Tabs.TabPane tab="London" key="london" />
        </Tabs>
        {/* <div>Audible data visualization on Brussels noise pollution.</div> */}
        {/* <div>Crank up the volume and mouse over the city.</div> */}
      </Row>

      <div style={{ marginTop: 100 }}>
        <div style={{ textAlign: 'center'}} > Designed by
          <span style={{ textAlign: 'center', marginTop: 8}}><a href="https://www.jetpack.ai" target="_blank" rel="noopener noreferrer"> <img alt="map" style={{marginLeft: 8, marginRight: 8, width: 120}} src={logo}/></a></span>
        </div>
      </div>
    </div>
  )
}

export default Panel;