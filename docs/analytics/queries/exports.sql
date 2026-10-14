SELECT uniqExact(person_id) AS Total FROM events WHERE event='native_export_completed' AND (properties.environment = 'production' AND properties.product = 'studio') AND {filters}
