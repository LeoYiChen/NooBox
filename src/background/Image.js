
export default NooBox => {
  NooBox.Image = {};
  NooBox.Image.reverseSearchCursor = 0;
  //contains functions that will fetch the useful data from search engines
  NooBox.Image.fetchFunctions = {};
  //Handles of context menu
  NooBox.Image.handles = {};
  //Functions to upload image to the internet
  NooBox.Image.POST = {};
  //servers for uploading
  NooBox.Image.POST.servers = ['ainoob.com'];
  //the order of uploading if one failed
  NooBox.Image.POST.serverOrder = [0];
  //functions for uploading
  NooBox.Image.POST.server = {};
  //upload the image then call itself, which will call fetch functions
  NooBox.Image.POST.general = null;
  //call POST.server[x] to upload image
  NooBox.Image.POST.upload = null;
  //add or remove image context menus
  NooBox.Image.updateContextMenu = null;
  //list of search engines
  NooBox.Image.engines = ["google", "baidu", "tineye", "bing", "yandex", "saucenao", "iqdb", "ascii2d"];
  //URLs for each search engine
  NooBox.Image.apiUrls = null;
  //search an image given URL or dataURI
  NooBox.Image.imageSearch = null;
  //update result in DB and send message to image.search.html
  NooBox.Image.update = null;
  //inject and run scripts to current tab
  NooBox.Image.screenshotSearch = null;
  //inject and run scripts to current tab
  NooBox.Image.extractImages = null;
  //download extracted images
  NooBox.Image.downloadExtractImages = null;
  NooBox.Image.updateContextMenu = () => {
    isOn('imageSearch',
      () => {
        if (!NooBox.Image.handles.imageSearch) {
          NooBox.Image.handles.imageSearch = chrome.contextMenus.create({
            "title": GL("search_this_image"),
            "contexts": ["image"],
            "onclick": NooBox.Image.imageSearch
          });
        }
      },
      () => {
        if (NooBox.Image.handles.imageSearch) {
          chrome.contextMenus.remove(NooBox.Image.handles.imageSearch);
          NooBox.Image.handles.imageSearch = null;
        }
      }
    );
    isOn('extractImages',
      () => {
        if (!NooBox.Image.handles.extractImages) {
          NooBox.Image.handles.extractImages = chrome.contextMenus.create({
            "id": "extractImages",
            "title": GL("extract_images"),
            "contexts": ["all"],
            "onclick": NooBox.Image.extractImages
          });
        }
      },
      () => {
        if (NooBox.Image.handles.extractImages) {
          chrome.contextMenus.remove(NooBox.Image.handles.extractImages);
          NooBox.Image.handles.extractImages = null;
        }
      }
    );
    isOn('screenshotSearch',
      () => {
        if (!NooBox.Image.handles.screenshotSearch) {
          NooBox.Image.handles.screenshotSearch = chrome.contextMenus.create({
            "id": "screenshotSearch",
            "title": GL("screenshot_search"),
            "contexts": ["all"],
            "onclick": NooBox.Image.screenshotSearch
          });
        }
      },
      () => {
        if (NooBox.Image.handles.screenshotSearch) {
          chrome.contextMenus.remove(NooBox.Image.handles.screenshotSearch);
          NooBox.Image.handles.screenshotSearch = null;
        }
      }
    );
  }

  NooBox.Image.imageSearch = async (info) => {
    NooBox.Image.engineMaxSearchSetting = await promisedGet('maxSearch');

    //create sandbox environment to run script
    let sandbox = document.createElement("iframe");
    sandbox.id  = "theFrame";
    sandbox.src = "sandbox.html";
    sandbox.style = "display:none";
    document.getElementsByTagName("body")[0].appendChild(sandbox);

    // console.log(NooBox.Image.engineMaxSearchSetting);
    const source = info.srcUrl || info;
    let cursor = await promisedGetDB('imageCursor');
    if (typeof (cursor) === 'number') {
      cursor++;
    } else {
      cursor = 0;
    }
   
    await promisedSetDB('imageCursor', cursor);
    NooBox.History.recordImageSearch(cursor, info);
    const engines = await promisedGetImageSearchEngines(NooBox.Image.engines);
    let action = 'dataURI';
    const result = {
      engines: engines
    };
    for (let j = 0; j < engines.length; j++) {
      result[engines[j]] = {
        result: 'loading'
      };
    }
    const dataURI = encodeURI(source);
    //if it is dataURI, using NooBox.Image.POST to upload the image and search
    if (dataURI.match(/^data/)) {
      result.imageUrl = 'dataURI';
      result.dataURI = dataURI;
      NooBox.Image.POST.general(cursor, result, engines, result.dataURI);
    } else {
      action = 'url';
      result.imageUrl = source;
      NooBox.Image.imageSearchByUrl(cursor, result, engines);
    }
    let type = result.imageUrl;
    if (type != 'dataURI') {
      type = 'url';
    }
    const url = '/image.search.html?cursor=' + cursor + '&image=' + type;
    const openTabFront = await promisedGet('imageSearchNewTabFront');
    chrome.tabs.create({ url, active: openTabFront });
    NooBox.Image.update(cursor, result);
    bello.event({
      category: 'imageSearch',
      action: action,
      label: type
    });
  }

  NooBox.Image.imageSearchByUrl = (cursor, result, engines) => {
    for (let i = 0; i < engines.length; i++) {
      ((cursor, engine) => {
        let maxSearchSetting = NooBox.Image.engineMaxSearchSetting[engine];
        NooBox.Image.imageSearchByUrlEngine(engine, result, cursor,maxSearchSetting);
      })(cursor, engines[i]);
      // NooBox.Image.imageSearchByUrlEngine(engines[i], result, cursor);
    }
  }

  NooBox.Image.imageSearchByUrlEngine = (engine, result, cursor,maxSearchSetting) => {
    const ajaxRequest = NooBox.Image.generateAjaxRequest(engine, result);
    const body = {};
    let xhr = new XMLHttpRequest();
    xhr.open(ajaxRequest.method || 'GET', ajaxRequest.url, true);
    // console.log(ajaxRequest.url);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
        result[engine].url = xhr.responseURL;
        NooBox.Image.fetchFunctions[engine](cursor, result, xhr.responseText,maxSearchSetting);
        if(engine == "google"){
          let followingPageLink = result.google.followingPageLink;
          let times = followingPageLink.length;
          let followingPageRequest = new Array(times);
          // console.log(typeof(result.google.websites));
          // window.abc = result.google.websites;
          // console.log(followingPageLink);
          for(let i = 0; i< times; i++){
            (function(i,link){
              followingPageRequest[i] = new XMLHttpRequest();
              followingPageRequest[i].open('GET',link,true);
              followingPageRequest[i].onreadystatechange = () =>{
                if(followingPageRequest[i].readyState === XMLHttpRequest.DONE && followingPageRequest[i].status === 200){
                  NooBox.Image.fetchFunctions.googleFowllingPage(cursor,result, followingPageRequest[i].responseText);
                }
              }
              followingPageRequest[i].send();
            })(i,followingPageLink[i]);
          }
        }else if(engine == "tineye"){
          let followingPageLink = result.tineye.followingPageLink;
          let times = followingPageLink.length; 
          let followingPageRequest = new Array(times);

          for(let i = 0; i< times; i++){
            (function(i,link){
              followingPageRequest[i] = new XMLHttpRequest();
              followingPageRequest[i].open('GET',link,true);
              followingPageRequest[i].onreadystatechange = () =>{
                if(followingPageRequest[i].readyState === XMLHttpRequest.DONE && followingPageRequest[i].status === 200){
                  NooBox.Image.fetchFunctions.tineyeFowllingPage(cursor,result, followingPageRequest[i].responseText);
                }
              }
              followingPageRequest[i].send();
            })(i,followingPageLink[i]);
          }
          // console.log(followingPageLink);
        }

      }
    };
  
    xhr.onerror = (e) => {
      result[engine].result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    };
    if (ajaxRequest.contentType) {
      xhr.setRequestHeader('Content-Type', ajaxRequest.contentType);
    }
    xhr.send(ajaxRequest.data ? Object.keys(ajaxRequest.data).map(
      function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(ajaxRequest.data[k]) }
    ).join('&') : null);
  };

  NooBox.Image.generateAjaxRequest = (engine, result) => {
    const imageUrl = result.uploadedURL || result.imageUrl;
    result[engine].url = NooBox.Image.apiUrls[engine] + imageUrl;
    const ajaxRequest = {};
    switch (engine) {
      case 'ascii2d':
        ajaxRequest.url = NooBox.Image.apiUrls[engine];
        ajaxRequest.method = 'POST';
        ajaxRequest.data = {
          uri: imageUrl
        };
        ajaxRequest.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
        break;
      default:
        ajaxRequest.url = result[engine].url;
    }
    return ajaxRequest;
  };

  NooBox.Image.apiUrls = {
    google: 'https://www.google.com/searchbyimage?&image_url=',
    baidu: 'https://image.baidu.com/n/pc_search?queryImageUrl=',
    tineye: 'http://www.tineye.com/search/?url=',
    bing: 'http://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:',
    yandex: 'https://www.yandex.com/images/search?rpt=imageview&img_url=',
    saucenao: 'http://saucenao.com/search.php?db=999&url=',
    iqdb: 'http://iqdb.org/?url=',
    sogou: 'http://pic.sogou.com/ris?query=',
    ascii2d: 'https://ascii2d.net/search/uri',
  };

  NooBox.Image.fetchFunctions.googleFowllingPage =(cursor,result,data)=>{
    try{
      data = data.replace(/<img[^>]*>/g, "");
      const page = $(data);
      let pageId = page.find('.cur').text();
      // window.x = page;
      let WebsiteList = page.find('.srg')[0];
      
      let releatedImageWebsites    = $(WebsiteList).find('.g');

      let websitesRelatedImageInfo = [];
      for(let i = 0; i < releatedImageWebsites.length; i++){
        const website = {
          link: '',
          title: '',
          description: '',
          searchEngine: 'google',
          related: false
        };
         //get child of related and Image website list
         const singleItem = $(releatedImageWebsites[i]);
         //get Tag <a></a> use this one to get the link and title
         const tagA = singleItem.find('a')[0] || {};

         website.link = tagA.href;
         website.title = tagA.innerText;

         const relatedImageDescriptionHTML = singleItem.find(".s").find(".st")[0] == undefined ? {} : singleItem.find(".s").find(".st")[0].innerHTML;
         let description = relatedImageDescriptionHTML.split(" ").filter((word) => ((word.indexOf('<') == -1) && (word.indexOf('>') == -1)) ).join(' ');
     
         website.description = description;

         const tagAImage = singleItem.find("a")[1] || {};
         const tagAImageLink = tagAImage.href;
        
         if (tagAImageLink) {
          const start = tagAImageLink.indexOf("imgurl=") + 7;
          const end = tagAImageLink.indexOf("&", start);
          if (end == -1)
            website.imageUrl = tagAImageLink.slice(start);
          else
            website.imageUrl = tagAImageLink.slice(start, end);
        }
    
      
        websitesRelatedImageInfo[websitesRelatedImageInfo.length] = website;
      }
      result.google.websites = result.google.websites.concat(websitesRelatedImageInfo);
      result.google.result = 'done';
      NooBox.Image.update(cursor, result);  
    }catch(e){
      console.log(e);
      result.google.result = 'failed';
      NooBox.Image.update(cursor, result);
    }
  };

  NooBox.Image.fetchFunctions.google = (cursor, result, data,maxSearchSetting) => {
    try {
      data = data.replace(/<img[^>]*>/g, "");
      const page = $(data);
      // tesing 
      // window.x = page;
      let allPageUrlData = page.find('tbody').find('a');
      let followingPageLink = [];
      //console.log(page);
      for(let i = 0; i < 9; i++){
        if(allPageUrlData[i] && allPageUrlData[i].className ==="fl" && allPageUrlData[i].href){
          followingPageLink[followingPageLink.length] = "https://www.google.com/search?tbs=" + allPageUrlData[i].href.split("search?tbs=")[1];
        }
      }
      // console.log(Math.ceil((maxSearchSetting - 5) / 10));
      if(followingPageLink.length >  Math.ceil((maxSearchSetting - 5) / 10)){

        followingPageLink.length = Math.ceil((maxSearchSetting - 5) / 10);
      }
      result.google.followingPageLink = followingPageLink;
      // console.log(followingPageLink);
      const keyword = page.find('.card-section').find('a[style = "font-style:italic"]')[0].innerHTML || "";
      //console.log(page);
      //03/ 17/ 2018 Update @George 
      //format website content
      let websitesRelatedInfo = [];
      //let relatedWebsiteList = $(page.find('#rso').find('._NId')[0]).find('.rc') || [];
      
      let WebsiteList = page.find('#search .srg');
      let websitesRelatedImageInfo = [];
      let releatedImageWebsites    = [];

        if(WebsiteList.length == 1){
          releatedImageWebsites = $(WebsiteList[0]).find(".g");
        }else{
          releatedImageWebsites = $(WebsiteList[1]).find(".g");
        }
          for (let i = 0; i < releatedImageWebsites.length; i++) {
            const website = {
              link: '',
              title: '',
              description: '',
              searchEngine: 'google',
              related: false
            };

            //get child of related and Image website list
            const singleItem = $(releatedImageWebsites[i]);
            //get Tag <a></a> use this one to get the link and title
            //The critical information are all in the tag a
            const tagA = singleItem.find('a')[0] || {};

            website.link = tagA.href;
            website.title = tagA.innerText;

            const relatedImageDescriptionHTML = singleItem.find(".s").find(".st")[0] == undefined ? {} : singleItem.find(".s").find(".st")[0].innerHTML;
            let description = relatedImageDescriptionHTML.split(" ").filter((word) => ((word.indexOf('<') == -1) && (word.indexOf('>') == -1)) ).join(' ');
        
            website.description = description;

            const tagAImage = singleItem.find("a")[1] || {};
            const tagAImageLink = tagAImage.href;
           
            
            if (tagAImageLink) {
              const start = tagAImageLink.indexOf("imgurl=") + 7;
              const end = tagAImageLink.indexOf("&", start);
              if (end == -1)
                website.imageUrl = tagAImageLink.slice(start);
              else
                website.imageUrl = tagAImageLink.slice(start, end);
            }
            websitesRelatedImageInfo[websitesRelatedImageInfo.length] = website;
        }   
        result.google.keyword = keyword;
        // result.google.relatedWebsites = websitesRelatedInfo;
        result.google.websites = websitesRelatedImageInfo;
        result.google.result = 'done';
        NooBox.Image.update(cursor, result);   
    } catch (e) {
      // console.log("Hello");
      console.log(e);
      result.google.result = 'failed';
      NooBox.Image.update(cursor, result);
    }
  };

  NooBox.Image.fetchFunctions.waitForSandBox = (parseObj) =>{
    return new Promise(function(resolve,reject){
      //移除 listener
      let remove = function(){
        window.removeEventListener("message",trigger);
      }
      //触发Resolve
      let trigger = function(event){
        // console.log(this)
        // console.log(remove);
        remove();
        resolve(event.data);
      }
      //添加Listener 
      window.addEventListener("message",trigger);
      //把数据发送Sandbox
      document.getElementById('theFrame').contentWindow.postMessage(parseObj, '*');
    })
  }

  NooBox.Image.fetchFunctions.baidu = async (cursor, result, data,maxSearchSetting) => {
    try {
      let baiduObj = {};
      var doc = (new window.DOMParser()).parseFromString(data,"text/html");
    
      //处理数据
      window.x = doc.getElementsByTagName('script')[2];
      let node = doc.getElementsByTagName('script')[2].innerHTML;
      node = node.substring(17,node.indexOf("bd.queryImageUrl")-1);
      baiduObj.bdString = "bd = " + node;
      let websites = [];
      //   需要取得的参数
      //   website.link 
      //   website.title 
      //   website.description 
      //   website.searchEngine = 'baidu';
      //   website.related = true;
      //   代码会在这里等待
      const {simiList,sameList,guessWord} = await NooBox.Image.fetchFunctions.waitForSandBox(baiduObj);
      let count = 0;
      //先处理 Same List
      if(sameList){
        while(maxSearchSetting >= 0 && count < sameList.length){

          let singleItem           = {};
          singleItem.imageUrl      = sameList[count].thumbURL || "";

          if(singleItem.imageUrl === ""){
            count++;
            continue;
          }
          singleItem.title         = sameList[count].fromPageTitle   || "";
          singleItem.link          = sameList[count].fromURL  ||"";
          singleItem.description   = sameList[count].textHost || "";
          singleItem.searchEngine  = 'baidu';
          singleItem.related       = true;

          //add website to websites
          maxSearchSetting--;
          websites[websites.length] = singleItem;
          count ++;
        }
      }
      //然后处理 Similar List
      count = 0;
      if(simiList){
        while(maxSearchSetting >= 0 && count < simiList.length){
          let singleItem   = {};
          singleItem.imageUrl      = simiList[count].MiddleThumbnailImageUrl ||"";
 

          if(singleItem.imageUrl === ""){
            count++;
            continue;
          }
          singleItem.link        = simiList[count].fromURL  ||"";
          singleItem.title       = simiList[count].fromPageTitle ||"";
          singleItem.description = simiList[count].FromPageSummary || "";
          singleItem.searchEngine  = 'baidu';
          singleItem.related       = true;

          //add website to websites
          maxSearchSetting--;
          websites[websites.length] = singleItem;
          count ++;
        }
      }
      //Summary
      result.baidu.keyword  = guessWord != undefined ? guessWord[0]:"";
      result.baidu.websites = websites;
      result.baidu.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      console.log(e);
      result.baidu.result = 'failed'
      NooBox.Image.update(cursor, result);
    }
  };
  NooBox.Image.fetchFunctions.tineyeFowllingPage = (cursor,result,data)=>{
    try{
      const page = (new window.DOMParser()).parseFromString(data,"text/html");
      const websiteList = page.getElementsByClassName("match-row") || [];
      let count = 0;
      let websites = [];
      while(count < websiteList.length){
        let singleResult = {};
        let singleItem   = websiteList[count];
        let thumb        = singleItem.getElementsByClassName("match-thumb")[0];
        let links        = singleItem.getElementsByTagName("a");
        // console.log(thumb.getElementsByTagName("img")[0].getAttribute("src"));
        singleResult.imageUrl = thumb.getElementsByTagName("img")[0].getAttribute("src")||"";

        for(let i = 0; i< links.length; i++){
          let matchString = links[i].innerHTML;
          if(matchString === "view image"){
            singleResult.link     = links[i + 1] ? links[i + 1].getAttribute("href"):"";
          }
        }
        // console.log(thumb);
        // console.log(singleResult.imageUrl);
        singleResult.imagePro     = {
          type: thumb.getElementsByTagName("span")[0].innerHTML.replace(",","") || "",
          imgSize : thumb.getElementsByTagName("span")[1].innerHTML.replace(",","") || "",
          fileSize : thumb.getElementsByTagName("span")[2].innerHTML.replace(",","") || "",
        };

        singleResult.searchEngine = "tineye"
        singleResult.description  = "";
        singleResult.title        = "";
        count ++;
        websites[websites.length] =   singleResult;
      }
      result.tineye.websites = result.tineye.websites.concat(websites);
      // console.log(result.tineye.websites);
      result.tineye.result = 'done';
      NooBox.Image.update(cursor, result);

    }catch(e){
      result.tineye.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  }
  NooBox.Image.fetchFunctions.tineye = (cursor, result, data,maxSearchSetting) => {
    try {
      // data = data.replace(/ src=/g, "nb-src=");
      const page = (new window.DOMParser()).parseFromString(data,"text/html");
      const websites = [];
      const totalSearchResult = Number.parseInt(page.getElementsByClassName("search-details")[0].getElementsByTagName("h2")[0].innerHTML.split(" ")[0] )
      // window.x = page;
      if(totalSearchResult){
        maxSearchSetting = totalSearchResult > maxSearchSetting ? maxSearchSetting : totalSearchResult;
      }
      // console.log(totalSearchResult);
      const websiteList = page.getElementsByClassName("match-row") || [];
      const links       = page.getElementsByTagName("link");
      let   pageLink;
      for(let i = 0; i< links.length; i++){
        if(links[i].getAttribute("href").indexOf("https") != -1 && links[i].getAttribute("rel") == "shortcut icon"){
          pageLink = links[i].getAttribute("href").replace("query","search");
        }
      }
      let followingPageLink = [];
      
      if(pageLink){
        const follwoing = page.getElementsByClassName("pagination-bottom")[0].getElementsByTagName("a");
        for(let i = 0; i < follwoing.length; i++){
          if(follwoing[i].getAttribute("class") == null){
            followingPageLink[followingPageLink.length] = pageLink + follwoing[i].getAttribute("href");
          }
        }
      }
      // console.log(followingPageLink);
      followingPageLink.length =  followingPageLink.length > Math.ceil( (maxSearchSetting - 10)/10) ? Math.ceil( (maxSearchSetting - 10)/10):followingPageLink.length;
      // console.log(followingPageLink.length);
      result.tineye.followingPageLink = followingPageLink;
      // console.log(websiteList);
      let count = 0;
      while(maxSearchSetting >= 0 && count < websiteList.length){
        let singleResult = {};
        let singleItem   = websiteList[count];
        let thumb        = singleItem.getElementsByClassName("match-thumb")[0];
        let links        = singleItem.getElementsByTagName("a");
        // console.log(thumb.getElementsByTagName("img")[0].getAttribute("src"));
        singleResult.imageUrl = thumb.getElementsByTagName("img")[0].getAttribute("src")||"";

        for(let i = 0; i< links.length; i++){
          let matchString = links[i].innerHTML;
          if(matchString === "view image"){
            singleResult.link     = links[i + 1] ? links[i + 1].getAttribute("href"):"";
          }
        }
        // console.log(thumb);
        // console.log(singleResult.imageUrl);
        singleResult.imageProp     = {
          type: thumb.getElementsByTagName("span")[0].innerHTML.replace(",","") || "",
          imgSize : thumb.getElementsByTagName("span")[1].innerHTML.replace(",","") || "",
          fileSize : thumb.getElementsByTagName("span")[2].innerHTML.replace(",","") || "",
        };

        singleResult.searchEngine = "tineye"
        singleResult.description  = "";
        singleResult.title        = "";
        maxSearchSetting -- ;
        count ++;
        websites[websites.length] =   singleResult;
      }
      // const websiteList = $(page.find('.match')) || [];
      // for (let i = 0; i < websiteList.length; i++) {
      //   const website = {
      //     searchEngine: 'tineye',
      //     related: true,
      //     description: ''
      //   };
      //   const temp = $(websiteList[i]);
      //   if (temp.find('.top-padding').length > 0) {
      //     website.title = $(temp).find('h4')[0].title;
      //     const x = temp.find('.top-padding').find('a')[0] || {};
      //     website.link = x.href;
      //     relatedWebsites.push(website);
      //   } else {
      //     website.title = $(temp).find('h4')[0].title;
      //     const x = $(temp).find('p').find('a')[2] || {};
      //     website.link = x.href;
      //     website.description = x.href;
      //     const y = $(temp).find('p').find('a')[1] || {};
      //     website.imageUrl = y.href;
      //     website.searchEngine = 'tineye';
      //     websites.push(website);
      //   }
      // }
      result.tineye.followingPageLink
      result.tineye.websites = websites;
      result.tineye.relatedWebsites = [];
      result.tineye.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      result.tineye.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  };

  NooBox.Image.fetchFunctions.bing = (cursor, result, data,maxSearchSetting) => {
    try {
      data = data.replace(/<img[^>]*>/g, "");
      const keyword = $(data).find('.query').text();
      result.bing.keyword = keyword;
      result.bing.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      result.bing.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  };

  NooBox.Image.fetchFunctions.yandex = (cursor, result, data,maxSearchSetting) => {
    try {
      data = data.replace(/<img[^>]*>/g, "");
      const page = $(data);
      const websites = [];
      const websiteList = $(page.find('.other-sites__item')) || [];
      for (let i = 0; i < websiteList.length; i++) {
        const website = {};
        const temp = $(websiteList[i]);
        const x = temp.find('.other-sites__snippet').find('a')[0] || {};
        website.link = x.href;
        website.title = x.innerText;
        const y = temp.find('.other-sites__desc')[0] || {};
        website.description = y.innerHTML;
        const z = temp.find('.other-sites__preview-link')[0] || {};
        website.imageUrl = z.href;
        website.searchEngine = 'yandex';
        websites.push(website);
      }
      result.yandex.websites = websites;
      result.yandex.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      result.yandex.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  };

  NooBox.Image.fetchFunctions.saucenao = (cursor, result, data,maxSearchSetting) => {
    try {
      data = data.replace(/ src=/g, " nb-src=");
      const page = $(data);
      const websites = [];
      const relatedWebsites = [];
      const websiteList = $(page.find('.result')) || [];
      for (let i = 0; i < websiteList.length; i++) {
        const website = {
          imageUrl: '',
          searchEngine: 'saucenao',
          related: true
        };
        const temp = $(websiteList[i]);
        website.link = "";
        website.title = "";
        const y = temp.find('.resulttable')[0];
        if (!y) {
          break;
        }
        website.description = y.innerHTML.replace(/(nb-src="\/image|nb-src="image)/g, 'src="http://saucenao.com/image');
        const z = temp.find('.resultimage').find('img')[0];
        if (z) {
          website.imageUrl = z.getAttribute('nb-src');
        }
        const rate = temp.find('.resultsimilarityinfo').text();
        if (rate.replace('%', '') > 90) {
          relatedWebsites.push(website);
        } else {
          websites.push(website);
        }
      }
      result.saucenao.relatedWebsites = relatedWebsites;
      result.saucenao.websites = websites;
      result.saucenao.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      result.saucenao.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  };

  NooBox.Image.fetchFunctions.iqdb = (cursor, result, data,maxSearchSetting) => {
    try {
      data = data.replace(/ src=\'\/([^\/])/g, " nb-src='$1");
      data = data.replace(/ src=\"\/\//g, ' nb1-src="');
      data = data.replace(/ href=\"\/\//g, ' nb-href="');
      const page = $(data);
      const websites = [];
      const websiteList = $(page.find('table')) || [];
      for (let i = 1; i < websiteList.length - 2; i++) {
        let description = '<table>' + websiteList[i].innerHTML.replace(/nb-src="/g, 'src="http://iqdb.org/') + '</table>';
        description = description.replace(/nb1-src="/g, 'src="http://');
        description = description.replace(/nb-href="/g, 'href="http://');
        const website = {
          link: "",
          title: "",
          imageUrl: "",
          searchEngine: "iqdb",
          description: description,
          related: true
        };
        if (websiteList[i].innerHTML.indexOf("Best match") != -1) {
          result.iqdb.relatedWebsites = [website];
        } else {
          websites.push(website);
        }
      }
      result.iqdb.websites = [];
      result.iqdb.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      result.iqdb.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  };

  var x;

  NooBox.Image.fetchFunctions.ascii2d = (cursor, result, data,maxSearchSetting) => {
    try {
      data = data.replace(/<img/g, "<nooboximage");
      const page = $(data);
      const websites = [];
      const relatedWebsites = [];
      const websiteList = $(page.find('.item-box')) || [];
      for (let i = 1; i < websiteList.length; i++) {
        const website = {
          searchEngine: 'ascii2d',
          description: ''
        };
        let temp = websiteList[i];
        temp = $(temp);
        const x = $(temp).find('.detail-box a')[0] || {};
        website.title = x.innerText;
        website.link = x.href;
        website.description = ($(temp).find('h6')[0] || { innerHTML: '' }).innerHTML.replace(/<nooboximage/g, '<img');
        website.imageUrl = 'https://ascii2d.net/' + $(temp).find('nooboximage').attr('src');
        website.searchEngine = 'ascii2d';
        if (i == 1) {
          relatedWebsites.push(website);
        }
        else {
          websites.push(website);
        }
      }
      result.ascii2d.websites = websites;
      result.ascii2d.relatedWebsites = relatedWebsites;
      result.ascii2d.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      result.ascii2d.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  };


  NooBox.Image.fetchFunctions.sogou = (cursor, result, data,maxSearchSetting) => {
    try {
      data = data.replace(/<img[^>]*>/g, "");
      x = $(data);
      var websites = [];
      /*var page=$(data);
      var websiteList=$(page.find('.other-sites__item'))||[];
      for(var i=0;i<websiteList.length;i++){
        var website={};
        var temp=$(websiteList[i]);
        var x=temp.find('.other-sites__snippet').find('a')[0]||{};
        website.link=x.href;
        website.title=x.innerText;
        var y=temp.find('.other-sites__desc')[0]||{};
        website.description=y.innerHTML;
        var z=temp.find('.other-sites__preview-link')[0]||{};
        website.imageUrl=z.href;
        website.searchEngine='sogou';
        websites.push(website);
      }*/
      result.sogou.websites = websites;
      result.sogou.result = 'done';
      NooBox.Image.update(cursor, result);
    } catch (e) {
      result.sogou.result = 'failed';
      NooBox.Image.update(cursor, result);
      console.log(e);
    }
  };

  NooBox.Image.POST.general = (cursor, result, engines, data, uploadedURL) => {
    if (uploadedURL) {
      NooBox.Image.imageSearchByUrl(cursor, result, engines);
    } else {
      NooBox.Image.POST.upload(cursor, result, data, NooBox.Image.POST.general.bind(null, cursor, result, engines, null));
    }
  }

  NooBox.Image.POST.upload = (cursor, result, data, callback) => {
    $.ajax({
      type: 'POST',
      url: 'https://ainoob.com/api/uploadImage/',
      contentType: 'application/json',
      data: JSON.stringify({
        data: data
      })
    }).done((data) => {
      result.uploadedURL = 'https://ainoob.com/api/getImage/' + data;
      callback(result.uploadedURL);
    });
  }

  NooBox.Image.update = (i, result) => {
    setDB('NooBox.Image.result_' + i,
      result,
      () => {
        chrome.runtime.sendMessage({
          job: 'image_result_update',
          cursor: i
        }, (response) => { });
      }
    );
  }


  NooBox.Image.extractImages = (info, tab) => {
    try {
      chrome.tabs.sendMessage(tab.id, {
        job: "extractImages"
      }, {
          frameId: info.frameId
        }, (response) => {
          if (!response) {
            chrome.notifications.create('extractImages', {
              type: 'basic',
              iconUrl: '/images/icon_128.png',
              title: chrome.i18n.getMessage("extractImages"),
              message: chrome.i18n.getMessage("ls_4")
            }, voidFunc);
          }
        });
    } catch (e) {
      chrome.tabs.sendMessage(tab.id, {
        job: "extractImages"
      }, (response) => {
        if (!response) {
          chrome.notifications.create('extractImages', {
            type: 'basic',
            iconUrl: '/images/icon_128.png',
            title: chrome.i18n.getMessage("extractImages"),
            message: chrome.i18n.getMessage("ls_4")
          }, voidFunc);
        }
      });
    }
  }

  NooBox.Image.downloadExtractImages = (sender, files) => {
    bello.event({
      category: 'downloadExtractImages',
      action: 'run'
    });
    const zip = new JSZip();
    let remains = files.length;
    let total = files.length;
    let i = 0;
    let file = files[i];
    const reader = new window.FileReader();
    reader.onloadend = () => {
      // console.log(remains);
      addImage(reader.result);
    }
    function addImage(dataURI) {
      if (dataURI) {
        const ext = (dataURI.slice(0, 20).match(/image\/(\w*)/) || ['', ''])[1];
        const binary = convertDataURIToBinary(dataURI);
        zip.file(file.name + '.' + ext, binary, {
          base64: false
        });
      }
      else {
        total--;
      }
      remains--;
      chrome.tabs.sendMessage(sender.tab.id, {
        job: 'downloadRemaining',
        remains: remains,
        total: total
      }, () => { });
      if (remains == 0) {
        zip.generateAsync({
          type: 'blob'
        }).then((content) => {
          saveAs(content, 'NooBox.zip');
        });
      } else {
        file = files[++i];
        if (file.url.slice(0, 4) == 'data') {
          addImage(file.url);
        } else {
          fetchBlob(file.url, (blob) => {
            if (blob) {
              reader.readAsDataURL(blob);
            }
            else {
              addImage();
            }
          });
        }
      }
    }
    if (file.url.slice(0, 4) == 'data') {
      addImage(file.url);
    } else {
      fetchBlob(file.url, (blob) => {
        if (blob) {
          reader.readAsDataURL(blob);
        }
        else {
          addImage();
        }
      });
    }
  }

  NooBox.Image.screenshotSearch = (info, tab) => {
    chrome.tabs.sendMessage(tab.id, 'loaded', (response) => {
      if (response == 'yes') {
        chrome.tabs.captureVisibleTab(tab.windowId, (dataURL) => {
          chrome.tabs.sendMessage(tab.id, {
            job: "screenshotSearch",
            data: dataURL
          });
        });
      } else {
        chrome.tabs.captureVisibleTab(tab.windowId, (dataURL) => {
          chrome.tabs.executeScript(tab.id, { file: 'thirdParty/jquery.min.js' }, () => {
            if (chrome.runtime.lastError) {
              chrome.notifications.create('screenshotFailed', {
                type: 'basic',
                iconUrl: '/images/icon_128.png',
                title: GL("ls_1"),
                message: GL("ls_2")
              }, voidFunc);
              return;
            }
            chrome.tabs.executeScript(tab.id, { file: 'js/screenshotSearch.js' }, () => {
              chrome.tabs.sendMessage(tab.id, {
                job: "screenshotSearch",
                data: dataURL
              });
            });
          });
        });
      }
    });
  }
};