let api = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/SGD`;
const fromDropDown = document.getElementById("from-currency-select");
const toDropDown = document.getElementById("to-currency-select");
const amountInput = document.getElementById("amount");

//Create dropdown from the currencies array
currencies.forEach((currency) => {
  const option = document.createElement("option");
  option.value = currency;
  option.text = currency;
  fromDropDown.add(option);
});

//Repeat same thing for the other dropdown
currencies.forEach((currency) => {
  const option = document.createElement("option");
  option.value = currency;
  option.text = currency;
  toDropDown.add(option);
});

// Dynamic URL
let urlParams = (new URL(document.location)).searchParams
fromDropDown.value = (urlParams.get("from") == null) ? "SGD" : urlParams.get("from").toUpperCase()
toDropDown.value = (urlParams.get("to") == null) ? "MYR" : urlParams.get("to").toUpperCase()
amountInput.value = (urlParams.get("value") == null) ? 1 : urlParams.get("value")
function updateUrl() {
  history.pushState({}, "", "https://test.augy.xyz/money-convert?from=" + fromDropDown.value + "&to=" + toDropDown.value + "&value=" + amountInput.value)
}
window.addEventListener("load", updateUrl)

// Prefetch currency conversion data to save on API calls
let convertData = {}
let prefetchData = () => {
  fetch(api)
    .then((resp) => resp.json())
    .then((data) => {
      convertData = data.conversion_rates;
      convertCurrency();
    });
}

let getConverted = (amount) => {
  let fromExchangeRate = convertData[fromDropDown.value];
  let toExchangeRate = convertData[toDropDown.value];
  return (amount / fromExchangeRate) * toExchangeRate;
};

let convertCurrency = () => {
  //Create References
  const amount = document.querySelector("#amount").value;
  const fromCurrency = fromDropDown.value;
  const toCurrency = toDropDown.value;

  //If amount input field is not empty
  if (amount.length != 0) {
    const convertedAmount = getConverted(amount);
    result.innerHTML = `${amount} ${fromCurrency} = ${convertedAmount.toFixed(
          2
        )} ${toCurrency}`;
  } else {
    alert("Please fill in the amount");
  }
};

let swapCurrency = () => {
  const amountDiv = document.querySelector("#amount");
  const amount = amountDiv.value;

  if (amount.length > 0) {
    amt = getConverted(amount);
    if (isNaN(amt)) amt = 0;
    amountDiv.value = amt;
  }

  const fromCurrency = fromDropDown.value;
  const toCurrency = toDropDown.value;
  toDropDown.value = fromCurrency;
  fromDropDown.value = toCurrency;
  updateUrl()
};

let convertBtn = document.getElementById("convert-button");
let swapBtn = document.getElementById("swap-button");

amountInput.addEventListener("keypress", function (event) {
  if (event.keyCode == 13) {
    convertCurrency();
  }
});
swapBtn.addEventListener("click", swapCurrency);
convertBtn.addEventListener("click", convertCurrency);

window.addEventListener("load", prefetchData);