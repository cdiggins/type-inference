# Myna Tests

There are two types of tests with Myna

1. **Parser tests** - Effectively these are unit tests run using QUnit or Mochas which test the core parsers, the various combinarors, and the sample grammars.  
2. **Tool tests** - These are integration tests, which test simples tools built using the sample grammars. 

The tool tests demonstrate how to use Myna in an actual tool. 

## Using Myna in a Browser 

Look at `tests\test_browser_unpkg.html` for an example of using Myna in the browser. Notice that instead of using a module loader we need to define a global variable called exports before including the Myna JavaScript file which will add a new variable called `Myna` to the global namespace. 

## Parser Tests 

To run the Parse tests open the `QUnit.html` file in your browser. You do not have to be using a server, you can just point your browser to the local file. 

## Tool Tests

To run the local tests you will need to use node from the root folder of the Myna distribution as follows:

```
  node tests\test_tools.js
```





