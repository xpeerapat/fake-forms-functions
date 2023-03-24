const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const app = express();

const axios = require('axios')
const cheerio = require('cheerio');
const request = require('superagent');

app.use(cors({ origin: true }));
app.use(express.json())

app.get('/', (req, res) => {
    res.status(200).send('Functions is running')
});

app.post('/', async (req, res) => {

    const { formUrl, xlData } = req?.body
    try {
        let data = await ghostIt(formUrl, xlData)
        return res.status(200).send(data)

    } catch (error) {
        return res.status(400).send(error)
    }


});

// exports.spam = functions.https.onRequest(app);

app.listen(3000, function () {
    console.log(`CORS-enabled web server listening on port 3000`)
})

async function ghostIt(form, xlData) {

    const formId = form.match(/(?<=e\/)[\w-_]+/g).at(0)
    const url = `https://docs.google.com/forms/d/e/${formId}/viewform`

    if (!formId) return 'Please check your URL'

    // scraping 
    const resp = await axios.get(url)
    if (resp.status !== 200) return "Can't load data in your URL"

    const $ = cheerio.load(resp.data);
    const attributeValue = $('script')
    const messyText = attributeValue.text()

    let fieldsId = messyText.match(/(\d{5,})(?=\,\[\[)|(?<=[\d]\,\[\[)(\d{5,})/g)

    // init dataObj
    let dataObj = {}
    let xlColumn = xlData.at(0)
    for (let i = 0; i < xlColumn.length; i++) {
        dataObj[xlColumn[i]] = 'entry.' + fieldsId[i]
    }

    // submit
    let errorCount = 0
    let errorAtRow = []
    for (let i = 1; i < xlData.length; i++) {

        let userForm = {}
        let entryId = Object.values(dataObj)

        for (let j = 0; j < entryId.length; j++) {
            let data = xlData[i][j]
            if (data == '-') {
                //do nothing
            } else {
                userForm[entryId[j]] = data
            }
        }

        request
            .post(`https://docs.google.com/forms/d/e/${formId}/formResponse`)
            .type('form')
            .send(userForm)
            .end(function (err, res) {
                if (err || !res.ok) {
                    errorAtRow.push(i + 1)
                    errorCount += 1
                    console.error('error : ', err);
                } else {
                    console.log('::: success :::');
                }
            });

    }

    if (errorCount != 0) {
        return {
            status: "error",
            message: `There is ${errorCount} rows failed to submit`,
            errorAtRow: errorAtRow
        }

    } else {
        return {
            status: "success",
            message: `All data have completed submit`
        }
    }

}