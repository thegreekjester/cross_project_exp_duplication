var axios = require('axios');
var argv = require('yargs').argv;
var page_ids = []
var data;

//Header config for the axios requests
var config_post = {
  headers: {
    'Authorization': `Bearer ${argv.token}`,
    'Content-Type': 'application/json'
  }
}

var config_get = {
  headers: {
    'Authorization': `Bearer ${argv.token}`
  }
}

var expJSON = {}


//axios request to get the experiment I want to move
axios.get(`https://api.optimizely.com/v2/experiments/${argv.experiment_id}`, config_get)
  .then((res) => {
    data = res.data
    expJSON.project_id = argv.project_id
    expJSON.audience_conditions = data.audience_conditions
    expJSON.changes = data.changes
    expJSON.holdback = data.holdback
    expJSON.name = 'DAT_NEW_EXPERIMENT'
    expJSON.metrics = data.metrics
    expJSON.variations = data.variations
    expJSON.variations.forEach(function(variation) {
      delete variation.variation_id
    })
    var promise = new Promise((resolve, reject) => {
        data.page_ids.forEach(function(page) {
          console.log('in for each')
          axios.get(`https://api.optimizely.com/v2/pages/${page}`, config_get)
            .then((res) => {
              res.data.project_id = argv.project_id
              axios.post('https://api.optimizely.com/v2/pages', JSON.stringify(res.data), config_post)
                .then((response) => {
                  page_ids.push(response.data.id)
                  console.log("SUCCESS, MADE THE PAGE")
                  if (page_ids.length === data.page_ids.length) {
                    console.log('they are the same length now')
                    resolve()
                  }
                })
                .catch((error) => {
                  console.log(error)
                })
              //This marks te end of the post request for the page
            })
            .catch((error) => {
              console.log("oops")
            })
          //This marks the end of the get request for the pages
        })
      })
      //This marks the end of the promise
      promise.then(() => {
        console.log('this is page_ids', page_ids)
        expJSON.page_ids = page_ids
        axios.post('https://api.optimizely.com/v2/experiments', JSON.stringify(expJSON), config_post)
          .then((res) => {
            console.log("SUCCESS FOR MAKING THE EXPERIMENT!")
          })
          .catch((error) => {
            console.log(error)
          })

      })
      console.log('passed it')
  })
  //This marks the end of the get request for the origignal get for the experiment
  .catch((error) => {
    console.log(error)
  })
