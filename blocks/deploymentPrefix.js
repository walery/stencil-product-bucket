let deploymentPrefix = null;

module.exports.resolve = async ({serverless, variableUtils, slsHelper}) => {
  if (deploymentPrefix !== null) {
    return deploymentPrefix;
  }

  let component;
  try {
    component = await variableUtils.resolveVariable('self:custom.component');
  } catch {
    throw new serverless.classes.Error('To create deploymentPrefix you must provide `custom.component` property.');
  }

  deploymentPrefix = `${slsHelper.env}/${component}/serverless`;
  return deploymentPrefix;
};
