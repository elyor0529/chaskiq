require "open-uri"

class Api::V1::HooksController < ActionController::API

  def create
    # get amazon message type and topic
    amz_message_type = request.headers['x-amz-sns-message-type']
    amz_sns_topic = request.headers['x-amz-sns-topic-arn']

    #return unless !amz_sns_topic.nil? &&
    #amz_sns_topic.to_s.downcase == 'arn:aws:sns:us-west-2:867544872691:User_Data_Updates'
    request_body = JSON.parse request.body.read
    # if this is the first time confirmation of subscription, then confirm it
    if amz_message_type.to_s.downcase == 'subscriptionconfirmation'
      send_subscription_confirmation request_body
      render plain: "ok" and return
    end

    if amz_message_type == "Notification" or request_body["Type"] == "Notification"
      if request_body["Message"] == "Successfully validated SNS topic for Amazon SES event publishing."
        render plain: "ok" and return
      else
        process_event_notification(request_body)
        render plain: "ok" and return
      end
    end

    #process_notification(request_body)
    render plain: "ok" and return
  end

private

  def process_event_notification(request_body)
    message = parse_body_message(request_body["Message"])
    track_message_for(message["eventType"].downcase, message)
  end

  def parse_body_message(body)
    JSON.parse(body)
  end

  def track_message_for(track_type, m)
    SnsReceiverJob.perform_later(track_type, m, request.remote_ip)
  end

  def send_subscription_confirmation(request_body)
    subscribe_url = request_body['SubscribeURL']
    return nil unless !subscribe_url.to_s.empty? && !subscribe_url.nil?
    open subscribe_url
  end

end