'use strict';
var AWS = require('aws-sdk');
var response = require('./cfn-response')
var s3 = new AWS.S3();


let deleteS3IndexFile = function(requestObj) {
    return new Promise(function(resolve, reject) {
        var params = {
            Bucket: requestObj.bucketname,
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
                if (err.code == "NoSuchBucket") {  // No sweat, bucket doesn't exist
                    resolve(requestObj) // I'm just going to pretend this didn't happen
                }
                else {
                    resolve(requestObj);
                }
            } else {
                resolve(requestObj);

            }


        })
    })
}

let deleteS3Bucket = function(requestObj) {
    return new Promise(function (resolve, reject) {
        s3.deleteBucket({Bucket: requestObj.bucketname}, function (err, data) {
            if (err) {
                resolve(requestObj); // Ignore it .. Might be other stuff in the bucket
            } else {
                resolve(requestObj);
                // All good
            }
        });
    })
}

exports.handler = (event, context, callback) => {

    console.log("start")

    if (event.RequestType == 'Delete') {
        var requestObj = {};
        requestObj.filename = "index.html";
        requestObj.bucketname = event.ResourceProperties['bucketname'];
        // requestObj.url = event.ResourceProperties['url'];

        deleteS3IndexFile(requestObj).
        then ( deleteS3Bucket).
        then ( function ( responseObj) {
            response.send(event, context, response.SUCCESS, {bucketname: responseObj.bucketname});
        })
    }
    else {
        response.send(event, context, response.SUCCESS, {});


    }
}
