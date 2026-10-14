SELECT uniqExact(distinct_id) AS Total FROM events WHERE event='signup_verified' AND (properties.environment = 'production' AND properties.product = 'studio') AND {filters}
