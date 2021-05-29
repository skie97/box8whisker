# Lightweight Box Plot custom visual for Power BI
A lighter custom visual based on code from the sample-barchart.
Need to set "Don't Summarize" for the Aggregation for the values.
I haven't yet figured out how to not use the "Don't Summarize" option. The data is bound in a table form rather than categorical as the categorical value data vanishes when the "Don't Summarize" is enabled.

Most other examples of the box plot uses bins to split up the data. But I find the box plot more initutive if it is split based on categories. At least, that is how I typcially use this. 

## TODO:
- Automatic y-axis label length adjustment based on font-size
- ~~Outlier dot fill and size settings~~