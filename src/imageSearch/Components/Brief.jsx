
import React from 'react';
import styled from 'styled-components';
import {Button, Card,Row,Col} from 'antd';

const BriefContainer = styled.div`
  height: 20%;
  .custom-image img {
    display: block;
  }
  .custom-card {
    padding: 10px 16px;
  }
  .custom-card p {
    color: #999;
  }
  .engineImages{
    margin-top: 20%;
    margin-left: 30px;
  }
`;
export default function Brief(props){
  const{source, keyword , results, engines} = props;
  const n = Math.floor(24/props.engines.length);

  let eachIcon;
  if(engines == ""){
    eachIcon = engines.map((element,index) =>{
      return (
              <Card.Grid style = {{width: "25%", textAlign: "center"}} key = {index}>
                  <img style ={{height: 50}} key = {index} src={'/thirdParty/'+element+'.png'} />
              </Card.Grid>
              );
    });

  }else{
    eachIcon = engines.map((element,index) =>{
      return (
              <Card.Grid style = {{width: "25%", textAlign: "center"}} key = {index}>
                <a key ={index} target="_blank" key = {index} href = {(results[element] || {}).url}>
                  <img style ={{height: 50}} key = {index} src={'/thirdParty/'+element+'.png'} />
                </a> 
              </Card.Grid>
              );
    });
  }
 
  console.log(props)
  return(
    <BriefContainer>
      <Row type = "flex" justify="start" align="bottom">
        <Col span ={2}/>
        <Col span ={6}>
          <Card style={{ width: "100%",height: "100%" }} bodyStyle={{ padding: 0 }}>

            <div className="custom-image">
              <img id = "imageInput" alt="example" width="100%" src={source} />
            </div>
            
            <div className="custom-card">
            {/* need translate */}
            <div> Keywords </div>
            {keyword}
        
            </div>
          </Card>
        </Col>
        <Col span ={1}/>
        <Col span ={10}>
          <Card style={{ width: "100%"}} bodyStyle={{ padding: 0 }}>
              {eachIcon}
          </Card>
        </Col>
        <Col span ={2}/>
      </Row>

    </BriefContainer>
   
  );
}