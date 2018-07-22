'use strict';
var AWS = require('aws-sdk');
var response = require('./cfn-response')
var url = require('url');
var https = require('https');
var fs = require('fs');
var request = require('request');
var s3 = new AWS.S3();


var myBucket = "";
var myHTML = "";

// Retrieve HTML form Github repo for login widget, you can use your own
let getHtmlFromGithub = function (resultObj) {

    var fetchedUrl=resultObj.url;
    return new Promise(function (resolve, reject) {
        var options = {
            method: 'GET',
            url: fetchedUrl,
            headers:
                {
                    'cache-control': 'no-cache',
                    'content-type': 'a',
                    accept: 'application/json'
                },
            body: ''
        };

        request(options, function (error, response, body) {
            if (error) reject (error);
            // var returnValue = {}
            resultObj.data = body;
            resolve(resultObj);
        });
    })
}

let createS3Bucket = function (resultObj) {
    var createbucketname= resultObj.bucketname;
    return new Promise(function (resolve, reject) {

        // console.info ("here");
        createbucketname=createbucketname.toLowerCase().replace(/[^0-9a-z]/gi, ''); //rip out non alphanumerics

        // Just in case someone gives a bucket name too short
        while ( createbucketname.length < 8 ) {
            createbucketname=createbucketname+Math.random().toString(36).substr(2, 2);
        }

        s3.createBucket({Bucket: createbucketname, ACL: 'public-read'}, function (err, data) {
            if (err) {
                console.log(err)

                if (err.code == "BucketAlreadyExists") { //no sweat.. already there
                    resultObj.bucketname= createbucketname;
                    resolve(resultObj)
                }
                else { //maybe bucketname didn't meet requirements ?
                    reject(err)
                }
            } else { // no errors, great
                resultObj.bucketname= createbucketname;
                resolve(resultObj)
            }
        });

    });
}


let createIndexFile = function (requestObj) {
    return new Promise(function (resolve, reject) {
        var metaData = 'text/html'
        var fileString = requestObj.data
        var buf = Buffer.from(fileString, 'utf-8')

        s3.putObject({
            ACL: 'public-read',
            Bucket: requestObj.bucketname,
            Key: requestObj.filename,
            Body: buf,
            ContentType: metaData
        }, function (error, response2) {
            if ( error) {
                reject ("can't create index file")
            }
            resolve(requestObj)
        });
    })
}

let deleteS3Bucket = function(bucketname, callback) {
    return new Promise(function(resolve, reject) {
        var params = {
            Bucket: bucketname,
            Delete: { // required
                Objects: [ // required
                    {
                        Key: "index.html" // required
                    }
                ],
            },
        };

        s3.deleteObjects(params, function(err, data) {
            if (err) {
                if ( err.code == "NoSuchBucket") {  // No sweat, bucket doesn't exist
                    resolve()
                }
                else {
                    callback(err)

                }
            }
            else {
                console.log("File gone");
                s3.deleteBucket({Bucket: myBucket}, function (err, data) {
                    if (err) {
                        callback ( err )
                    } else {
                        resolve () // All good
                    }
                });

            } // successful response
        });

    });
}




exports.handler = (event, context, callback) => {

    console.log("start")
    myBucket = event.ResourceProperties['bucketname']


    // You can change this, or even pull from the file system, this is just an example
    var tempUrl = myHTML

    if (event.RequestType == 'Create') {

        var requestObj = {};
        requestObj.filename = "index.html";
        requestObj.bucketname = event.ResourceProperties['bucketname'];
        requestObj.url = event.ResourceProperties['url'];

        getHtmlFromGithub(requestObj).
        then(createS3Bucket).
        then(createIndexFile).
        then ( (data) => {

            response.send(event, context, response.SUCCESS, {bucketname: "https://s3.amazonaws.com/"+data.bucketname+"/index.html"});

        }).catch ( function(errr) {
            response.send(event, context, response.FAILED, errr);

        })

    } else if (event.RequestType == 'Delete') {
        console.log("in Delete") // Clean up the S3 Bucket, delete everything
        deleteS3Bucket(myBucket, callback).then(function () {
            response.send(event, context, response.SUCCESS, {});
        })
    } else {
        console.log(event)
        console.log(context)
        response.send(event, context, response.SUCCESS, {});
    }
}


