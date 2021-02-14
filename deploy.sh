#!/bin/bash

STACK_NAME=""
ENV=""
AWS_PROFILE=""
AWS_REGION="us-east-1"
AWS_MIN_VERSION='1.16.119'

WORKSHEET_PDF="users-_userId-worksheets-_worksheetId-pdf-post"
SHARED_FOLDER_PATH="appi/lambdas/shared"
SHARED_FOLDER_NAME="shared"
NODE_LAYER_ARN=""
PY_LAYER_ARN=""

FUNC="all"
SKIP_LAYER=0

function usage() 
{
    echo "usage: $0 [-e environment_name] [-s stack_name] [-p aws_profile_name] [options]"
    echo "Required:"
    echo "  -e        Used to specify the environment name of the deployment."
    echo "  -s        Used to specify the stack name that prefixes all resources in AWS."
    echo "  -p        Used to specify the AWS profile name."
    echo "Options:"
    echo "  -l        Used to skip uploading a new Lambda Layer."
    echo "  -r        Used to specify the AWS region. Defaults to us-east-1."
    echo "  -f        Used to specify the name of the function to deploy. Not specitying this flag will deploy the entire code-base serially."
    echo "            (-f) argument format expectations:"
    echo "               * The function name must be listed in the deploy.config.yaml file."
    echo "               * The function must exist in the AWS environment you are deploying to, under the same name suffix."
    exit 1
}

function check_required_options()
{
  if [ -z $ENV ]; then
    echo -e "\033[31mThe environment name flag (-e) must be included for a deployment to run\033[0m" >&2
  fi

  if [ -z $STACK_NAME ]; then
    echo -e "\033[31mThe stack name flag (-s) must be included for a deployment to run\033[0m" >&2
  fi

  if [ -z $AWS_PROFILE ]; then
    echo -e "\033[31mThe AWS profile name flag (-p) must be included for a deployment to run\033[0m" >&2
  fi

  if  [ -z $ENV ] ||  [ -z $STACK_NAME ] ||  [ -z $AWS_PROFILE ]; then
    usage
    exit 1
  fi
}

function parse_version { echo "$@" | awk -F. '{ printf("%03d%03d%03d\n", $1,$2,$3); }'; }

function check_required_programs()
{
  if ! hash aws 2>/dev/null; then
    echo "aws-cli is not installed." >&2
  else
    aws_versions=$(aws --v)
    version=${aws_versions:(8):(8)}

    if [ "$(parse_version "$version")" -lt "$(parse_version "$AWS_MIN_VERSION")" ]; then
      echo -e "\033[31maws-cli needs to be upgraded.\033[0m"
      exit 1
    fi
  fi

  if ! hash jq 2>/dev/null; then
    echo "jq(1) is not installed." >&2
  fi

  if ! hash pip3 2>/dev/null; then
    echo "pip3 is not installed." >&2
  fi

  if ! hash aws 2>/dev/null || ! hash jq 2>/dev/null || ! hash pip3 2>/dev/null; then
    echo -e "\033[31merror: Please install missing dependencies.\033[0m" >&2
    exit 1
  fi
}

function update_lambda_config()
{
  aws lambda update-function-configuration \
  --region "${AWS_REGION}" \
  --function-name "${1}" \
  --layers "${2}" \
  --profile "${AWS_PROFILE}"
}

function update_lambda()
{
  aws lambda update-function-code \
  --region "${AWS_REGION}" \
  --function-name "${1}" \
  --zip-file "fileb://${2}.zip" \
  --profile "${AWS_PROFILE}"
}

function yaml2json() 
{ 
  ruby -ryaml -rjson -e 'puts JSON.pretty_generate(YAML.load(ARGF))' $*
}

function run_tests()
{
  echo "Installing dev dependencies for tests..."
  pushd "${SHARED_FOLDER_PATH}" >> /dev/null

  if [ -d "tests/node" ]; then
    npm install --loglevel=error
    echo "Running node tests..."
    npm test
    if [ $? -ne 0 ]; then exit 1; fi
    rm -rf node_modules
  fi

  if [ -d "tests/py" ]; then
    pip3 install -r requirements-dev.txt -t py_modules
    echo "Running py tests..."
    python3 tests/py/*
    if [ $? -ne 0 ]; then exit 1; fi
    rm -rf py_modules
  fi

  popd >> /dev/null
}

function archive_lambda_layers()
{
  STACK_NAME=$(jq -cr '.Parameters.StackName' < .stage-config/config-${ENV}.json)
  NODE_LAYER="${STACK_NAME}-${ENV}-backend-node_modules"
  PY_LAYER="${STACK_NAME}-${ENV}-backend-py_modules"

  echo "Installing packages and building Lambda layers..."
  pushd "${SHARED_FOLDER_PATH}" >> /dev/null

  if [ -n "$(find . -maxdepth 1 -type f -name 'package.json')" ]; then
    mkdir nodejs
    npm install --production --loglevel=error
    mv node_modules nodejs/node_modules
    zip -r nodejs.zip nodejs
    NODE_LAYER_ARN=$(aws lambda publish-layer-version --layer-name "${NODE_LAYER}" --zip-file fileb://nodejs.zip --compatible-runtimes nodejs10.x nodejs8.10 --profile "${AWS_PROFILE}" | jq -cr '.LayerVersionArn')
    rm -rf nodejs.zip
    rm -rf nodejs
  fi

  if [ -n "$(find . -maxdepth 1 -type f -name 'requirements.txt')" ]; then
    mkdir python
    pip3 install -r requirements.txt -t python
    zip -r python.zip python
    PY_LAYER_ARN=$(aws lambda publish-layer-version --layer-name "${PY_LAYER}" --zip-file fileb://python.zip --compatible-runtimes python3.6 python3.7 --profile "${AWS_PROFILE}" | jq -cr '.LayerVersionArn')
    rm -rf python.zip
    rm -rf python
  fi

  popd >> /dev/null
}

function archive_lambdas()
{
  if [ $SKIP_LAYER != 1 ]; then
    archive_lambda_layers
  fi 

  LAMBDAS=$(cat deploy.config.yaml | yaml2json | jq -c '.Lambdas')
  for row in $(echo "${LAMBDAS}" | jq -r '.[] | @base64'); do
    _jq() { 
      echo "${row}" | base64 --decode | jq -r "${1}" 
    }

    name=$(_jq '.name')
    path=$(_jq '.path')

    if [ $FUNC != "all" ]; then
      if [ $FUNC != "$name" ]; then
        echo -e "\033[2mskipping $name\033[0m"
        continue
      else
        echo "uploading $name"
      fi
    fi

    rsync -avzhe --exclude='package*.json' --exclude='tests' --exclude='requirements*.txt' "$SHARED_FOLDER_PATH" "$path" >> /dev/null
    
    pushd "$path" >> /dev/null

    if [ "$name" = "$WORKSHEET_PDF" ]; then
      npm install --loglevel=error
      echo "running npm run package"
      npm run package
    else
      zip -qdgds 10M -r "${name}.zip" ./*
    fi

    update_lambda "${STACK_NAME}-${ENV}-${name}" "${name}"

    if [ -n "$(find . -maxdepth 1 -type f -name '*.js')" ] && [ -n "${NODE_LAYER_ARN}" ] && [ $SKIP_LAYER != 1 ] && [ "$name" != "$WORKSHEET_PDF" ]; then
      update_lambda_config "${STACK_NAME}-${ENV}-${name}" "${NODE_LAYER_ARN}"
    fi 

    if [ -n "$(find . -maxdepth 1 -type f -name '*.py')" ] && [ -n "${PY_LAYER_ARN}" ] && [ $SKIP_LAYER != 1 ] && [ "$name" != "$WORKSHEET_PDF" ]; then
      update_lambda_config "${STACK_NAME}-${ENV}-${name}" "${PY_LAYER_ARN}"
    fi

    rm -rf "${name}".zip
    rm -rf "${SHARED_FOLDER_NAME}"

    popd >> /dev/null
  done
}

# get flags
while getopts "e:s:p:r:f:lh" o; do
  case "${o}" in
    f)
      FUNC=${OPTARG}
      ;;
    e)
      ENV=${OPTARG}
      ;;
    s)
      STACK_NAME=${OPTARG}
      ;;
    p)
      AWS_PROFILE=${OPTARG}
      ;;
    l)
      SKIP_LAYER=1
      ;;
    r)
      AWS_REGION=${OPTARG}
      ;;
    h)
      usage; 
      exit;;
    \?)
      echo "Unknown option: -$OPTARG" >&2;
      exit 1;;
    :)
      echo "Missing option argument for -$OPTARG" >&2;
      exit 1;;
    *)
      echo "Invalid option: -$OPTARG" >&2;
      exit 1;;
  esac
done

check_required_programs
check_required_options

echo -e "\033[1mStarting $ENV deployment for $STACK_NAME:\033[0m" ;

# run_tests
archive_lambdas
