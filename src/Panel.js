import React from "react"

import logo from './assets/Jetpack-small.png'
import possibleLogo from './assets/possible.png'
import carFreeLogo from './assets/carFree.png'
import { Row, Tabs } from 'antd'

function Panel({setCity, city, part, intro1, intro2, sources, outro, language}) {
  return (
    <div>
      {(!part || part === 1) &&
        <div>
          <a href="https://www.carfreemegacities.org" target="_blank" rel="noopener noreferrer"> 
            <img src={carFreeLogo} alt="Car Free Megacities logo" style={{width: '100%'}} />
          </a>
          {intro1}
          <Row type="flex">
            <Tabs
              onChange={setCity}
              activeKey={city}
              centered
              style={{width: '100%'}}
              items={[
                { label: 'Paris', key: 'paris' },
                { label: 'New York', key: 'nyc' },
                { label: language === 'fr' ? 'Londres' : 'London', key: 'london' }
              ]}
            />
          </Row>
          {intro2}
        </div>
      }
      {(!part || part === 2) &&
        <div>
          {sources}
          <div style={{ textAlign: 'center'}} >
            <span style={{ textAlign: 'center', marginTop: 8}}><a href="https://www.wearepossible.org/" target="_blank" rel="noopener noreferrer"> <img alt="possible logo" style={{marginLeft: 8, marginRight: 8, width: '60%'}} src={possibleLogo}/></a></span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }} > Designed by
            <span style={{ textAlign: 'center', marginTop: 8}}><a href="https://www.jetpack.ai" target="_blank" rel="noopener noreferrer"> <img alt="jetpack logo" style={{marginLeft: 8, marginRight: 8, width: 120}} src={logo}/></a></span>
          </div>
          <div style={{ fontSize: 10, marginTop: 8, marginBottom: 32 }}>{outro}</div>
        </div>
      }
    </div>
  )
}

export default Panel;