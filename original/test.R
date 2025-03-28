library(nflfastR)
library(dplyr)

# Load 2023 play-by-play data
pbp_data <- load_pbp(c(2022, 2023, 2024))

colnames(pbp_data)

'''
# Filter for extra point kicks and two-point conversions
extra_point_kicks <- pbp_data %>%
  filter(extra_point_attempt == 1)

two_point_conversions <- pbp_data %>%
  filter(two_point_attempt == 1)

# Identify defensive touchdowns
defensive_tds_extra_points <- extra_point_kicks %>%
  filter(defensive_two_point_conv == TRUE)

defensive_tds_two_points <- two_point_conversions %>%
  filter(defensive_two_point_conv == TRUE)

# Compute conversion percentages including defensive touchdowns
conversion_summary <- tibble(
  type = c("Extra Point Kick", "Two-Point Conversion"),
  attempts = c(nrow(extra_point_kicks), nrow(two_point_conversions)),
  successful = c(sum(extra_point_kicks$extra_point_result == "good", na.rm = TRUE),
                 sum(two_point_conversions$two_point_conv_result == "success", na.rm = TRUE)),
  defensive_tds = c(nrow(defensive_tds_extra_points), nrow(defensive_tds_two_points)),
  conversion_percentage = (successful / attempts) * 100,
  defensive_td_percentage = (defensive_tds / attempts) * 100
)

# Display results
print(conversion_summary)
'''