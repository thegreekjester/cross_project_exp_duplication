const axios = require('axios');
const argv = require('yargs').argv;
var page_ids = [] // array of page ids that are generated in new project to be used for new duplicated experiment
var data;
var variation_pages = [] // this array holds objects that have the variation ID, action_id (for multiple changes), as well as the page_id used
var page_get_promises = [] // array of get requests for page information of old experiment
var page_post_promises = [] // array of post requests to create pages in new project
var mapping = {} // the finals mappings of old --> new page ids

//Header config for the axios post requests
var config_post = {
  headers: {
    'Authorization': `Bearer ${argv.token}`,
    'Content-Type': 'application/json'
  }
}
//Header config for the axios get requests
var config_get = {
  headers: {
    'Authorization': `Bearer ${argv.token}`
  }
}

var expJSON = {}

axios.get(`https://api.optimizely.com/v2/experiments/${argv.experiment_id}`, config_get) // grab experiment config of the one you wanna duplicate
  .then(function (res) {

    console.log('in OG promise')
    data = res.data // setting exp config to data

    // starting to build new exp config
    expJSON.project_id = argv.project_id // make the exp project the new one
    expJSON.audience_conditions = data.audience_conditions
    expJSON.changes = data.changes // transfer any shared code changes 
    expJSON.holdback = data.holdback
    expJSON.description = data.description || 'duplicated experiment from another project'
    expJSON.name = argv.exp_name || data.name + '_copy' // take the experiment name given or just the default plus 'copy'
    expJSON.metrics = data.metrics
    expJSON.variations = data.variations 

    
    expJSON.variations.forEach(function(variation,i) {
      delete variation.variation_id
      if(variation.actions.length > 0){
        variation.actions.forEach(function(action,j){
          variation_pages.push({variation_idx:i, action_idx:j,page_id:action.page_id})
        })
      }
    })
    console.log('variation_page_ids', variation_pages)
    // this next section takes care of cases where the experiment used URL targetin as opposed to saved pages
    // it also makes sure not to copy pages over into new project unnecessarily 
    console.log('in page/url targeting section')
    var exp_page_ids = data.page_ids || []

    //this next peice of code ONLY runs if the original expeirment used saved pages
      exp_page_ids.forEach(function (page_id) {
        page_get_promises.push(axios.get(`https://api.optimizely.com/v2/pages/${page_id}`, config_get))
      })


      // ******* running through all the page get requests ***************
      Promise.all(page_get_promises).then(function (page_configs) {
        console.log('in second promise')
        page_configs.forEach(function (page) {
          let page_obj = page.data
          delete page_obj.id
          delete page_obj.api_name
          delete page_obj.key
          page_obj.project_id = argv.project_id
          page_post_promises.push(axios.post('https://api.optimizely.com/v2/pages', JSON.stringify(page_obj), config_post))
        })


        // ************ running through all the page post requests ******************
        Promise.all(page_post_promises).then(function(values){
          values.forEach(function(value){
            page_ids.push(value.data.id)
          })
          if(page_ids.length > 0){
            expJSON.page_ids = page_ids
          }else{
            expJSON.url_targeting = data.url_targeting
          }
          // LMAO this is like zip(dict()) from python --> JS
          exp_page_ids.forEach(function(p,i){
            mapping[p] = page_ids[i]
          })

          console.log(mapping) // returns a mapping of old page ids to new ones

          variation_pages.forEach(function(obj){
            expJSON.variations[obj.variation_idx].actions[obj.action_idx].page_id = mapping[obj.page_id]

          })

          // ******* FINAL exp creation **************************
          axios.post('https://api.optimizely.com/v2/experiments', JSON.stringify(expJSON), config_post)
          .then((res) => {
           console.log("SUCCESS FOR MAKING THE EXPERIMENT!", res.data.variations[1].actions)
          })
          .catch((error) => { // final exp post request catch
            console.log('ooopsie', error.message)
          })
        })
        .catch(function(error){ //page post requests catch
          console.log('problem with the third promise', error)
        })

      })
        .catch(function (error) { // page get requests catch
          console.log('problem with pages being sought', error)
        })
  })
  .catch(function (error) { // first exp get request catch
    console.log('oops we have an error', error)
  })