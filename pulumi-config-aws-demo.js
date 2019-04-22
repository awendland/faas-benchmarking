const pulumi = require("@pulumi/pulumi")
const aws = require("@pulumi/aws")

///////////////
// Requester //
///////////////

let size = "t2.micro"    // t2.micro is available in the AWS free tier
let amznLinux2Ami = aws.ec2.getAmi({
  owners: "amazon",
  mostRecent: true,
  filters: [
    { name: "name", value: "amzn2-ami-hvm-*-x86_64-ebs" },
    { name: "virtualization-type", value: "hvm" },
  ],
})


// create a new security group for port 80
let requesterSecGroup = new aws.ec2.SecurityGroup(`${TEST_ID}-requester`, {
  tags: { "Purpose": "faas-benchmark", "TestID": TEST_ID },
  ingress: [
    { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
    { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
  ],
})

// (optional) create a simple web server using the startup script for the instance
let requesterUserData =
`#!/bin/bash
# TODO download requester executable from S3 (or wherever it's distributed)
echo "Hello, World!" > index.html
nohup python -m SimpleHTTPServer 80 &`

let requesterVM = new aws.ec2.Instance(`${TEST_ID}-requester`, {
  tags: { "Purpose": "faas-benchmark", "TestID": TEST_ID },
  instanceType: INSTANCE_SIZE,
  securityGroups: [ requesterSecGroup.name ], // reference the group object above
  ami: amznLinux2Ami,
  userData: requestedUserData              // start a simple web server
})

exports.publicIp = server.publicIp
exports.publicHostName = server.publicDns

//////////
// FaaS //
//////////
// TODO create this depending on the test being run

const lambdaPolicy = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com",
      },
      "Effect": "Allow",
      "Sid": "",
    },
  ],
}

const lambdaRole = new aws.iam.Role("precompiled-lambda-role", {
  assumeRolePolicy: JSON.stringify(lambdaPolicy),
})

const csharpLambda = new aws.lambda.Function("aws-hellolambda-csharp", {
  tags: { "Purpose": "faas-benchmark", "TestID": TEST_ID },
  runtime: aws.lambda.DotnetCore2d0Runtime,
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("./csharp/bin/Debug/netcoreapp2.0/publish"),
  }),
  timeout: 5,
  handler: "app::app.Functions::GetAsync",
  role: lambdaRole.arn
})
