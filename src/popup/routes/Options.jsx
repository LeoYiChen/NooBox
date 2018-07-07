import React from "react";
//redux
//__MSG_appName__
import {connect} from 'dva';
import reduxActions from "SRC/popup/reduxActions.js";
import reselector   from "SRC/popup/reselector.js";

import {Tree,Card, Col, Row,Spin} from 'antd';
import styled from "styled-components";
import {engineMap} from 'SRC/constant/settingMap.js';
import Loader      from "SRC/common/component/Loader.jsx";
const TreeNode  = Tree.TreeNode;
const OptionsContainer = styled.div`
  margin-left:15px;
  margin-top:5px;
  margin-right:15px;
  h4{
    border-bottom: 1px solid #d9d9d9;
  }
  .engineOpen{
    height:35px;
    opacity: 1;
    transition: opacity .25s ease-in-out;
  }
  .engineOpen:hover{
    cursor:pointer
  }
  .engineClose{
    height:35px;
    opacity: 0.2;
    transition: opacity .25s ease-in-out;
  }
  .engineClose:hover{
    cursor:pointer
  }
`;
class Options extends React.Component{
  componentWillMount(){
    const {options,actions} = this.props;
    if(!options.inited){
      actions.optionsInit();
    }
  }
  renderTreeNodes(data){
    return data.map((item) => {
      if (item.children) {
        return (
          <TreeNode title={item.title} key={item.key} dataRef={item}>
            {this.renderTreeNodes(item.children)}
          </TreeNode>
        );
      }
      return <TreeNode {...item} />;
    });
  }
  generateIcon(actions,currentEngine){
    return engineMap.map((element,index) => (
    <Col span ={6} key ={index}>
      <Card bordered={false}>
        <img 
          src ={element.icon}
          onClick ={() => actions.optionsCheckEngine(element.dbName)} 
          className ={currentEngine[element.dbName] ?"engineOpen":"engineClose"} />
      </Card>
    </Col>
    ))
  }
  render(){
    let {actions,options} = this.props;
    if(!options.inited){
      return <Loader/>
    }
    return(
      <OptionsContainer>
        <div id = "exp">
          <h4>Experience</h4>
          <Tree
            checkable
            onCheck={(e)=>actions.optionsCheckExp(e)}
            defaultCheckedKeys = {options.currentExp}>
            <TreeNode title ="History"      key = "history"/>
            <TreeNode title ="Check Update" key = "checkUpdate"/>
          </Tree>
        </div>
        <div id = "tool">
          <h4>Tools</h4>
          <Tree
            checkable
            onCheck={(e)=>actions.optionsCheckTool(e)}
            defaultCheckedKeys = {options.currentTool}
          >
            <TreeNode   title ="Auto Refresh (Alpha)"        key = "autoRefresh"/>
            <TreeNode   title ="HTML5 Video Control (Alpha)" key = "videoControl"/>
            <TreeNode   title ="Image"                       key = "image">
              <TreeNode title ="Reverse Image Search"        key = "imageSearch"/>
              <TreeNode title ="Open Result Tab In Front"    key = "imageSearchNewTabFront"/>
              <TreeNode title ="Extract Images"              key = "extractImages"/>
              <TreeNode title ="Screenshot & Search"         key = "screenshotSearch"/>
            </TreeNode>
          </Tree>
        </div>
        {
          options.showEngines ?
           (<div id = "engines">
              <h4>Avaiable Engines</h4>
              <Row gutter={-1}>
                {this.generateIcon(this.props.actions,options.currentEngine)}
              </Row>
            </div>): ("")
        }
       
      </OptionsContainer>
    )
  }
}


export default connect(reselector, reduxActions)(Options);