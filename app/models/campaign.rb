require "link_renamer"
require "open-uri"

class Campaign < Message

  validates :from_name, presence: true #, unless: :step_1?
  validates :from_email, presence: true #, unless: :step_1?

  def config_fields
    [
      {name: "from_name", type: 'string'} ,
      {name: "from_email", type: 'string'},
      {name: "reply_email", type: 'string'},
      {name: "description", type: 'text'} ,
      {name: "name", type: 'string'} ,
      {name: "scheduled_at", type: 'string'} ,
      {name: "timezone", type: 'string'} ,
      {name: "subject", type: 'text'} ,
      #{name: "settings", type: 'string'} ,
      {name: "scheduled_at", type: 'datetime'},
      {name: "scheduled_to", type: 'datetime'}
    ]
  end


  def delivery_progress
    return 0 if metrics.deliveries.size.zero?
    subscriptions.availables.size.to_f / metrics.deliveries.size.to_f * 100.0
  end

  def subscriber_status_for(subscriber)
    #binding.pry
  end

  def send_newsletter
    MailSenderJob.perform_later(self)
  end

  def test_newsletter
    CampaignMailer.test(self).deliver_later
  end

  def clone_newsletter
    cloned_record = self.deep_clone #(:include => :subscribers)
    cloned_record.name = self.name + "-copy"
    cloned_record
  end

  def detect_changed_template
    if self.changes.include?("template_id")
      copy_template
    end
  end

  #deliver email + create metric
  def push_notification(subscription)
    SesSenderJob.perform_later(self, subscription)
  end

  def prepare_mail_to(subscription)
    CampaignMailer.newsletter(self, subscription)
  end

  def copy_template
    self.html_content    = self.template.body
    self.html_serialized = self.template.body
    self.css = self.template.css
  end

  def mustache_template_for(subscriber)

    link_prefix = host + "/campaigns/#{self.id}/tracks/#{subscriber.encoded_id}/click?r="

    #html = LinkRenamer.convert(premailer, link_prefix)
    subscriber_options = subscriber.attributes
                                    .merge(attributes_for_template(subscriber))
                                    .merge(subscriber.properties)
                           
    compiled_premailer = premailer.gsub("%7B%7B", "{{").gsub("%7D%7D", "}}")                               
    Mustache.render(compiled_premailer, subscriber_options)

    #html = LinkRenamer.convert(compiled_mustache, link_prefix)
    #html
  end

  def campaign_url
    host = Rails.application.routes.default_url_options[:host]
    campaign_url = "#{host}/campaigns/#{self.id}"
  end

  def apply_premailer(opts={})
    host = Rails.application.routes.default_url_options[:host]
    skip_track_image = opts[:exclude_gif] ? "exclude_gif=true" : nil
    premailer_url = ["#{host}/apps/#{self.app.key}/campaigns/#{self.id}/premailer_preview", skip_track_image].join("?")
    url = URI.parse(premailer_url)
    self.update_column(:premailer, clean_inline_css(url))
  end

  #will remove content blocks text
  def clean_inline_css(url)
    
    html = open(url).readlines.join("")
    document = Roadie::Document.new html
    document.transform

    #premailer = Premailer.new(url, :adapter => :nokogiri, :escape_url_attributes => false)
    #premailer.to_inline_css
  end

  def attributes_for_template(subscriber)

    subscriber_url = "#{campaign_url}/subscribers/#{subscriber.encoded_id}"
    track_image    = "#{campaign_url}/tracks/#{subscriber.encoded_id}/open.gif"

    { email: subscriber.email,
      campaign_url: campaign_url,
      campaign_unsubscribe: "#{subscriber_url}/delete",
      campaign_subscribe: "#{campaign_url}/subscribers/new",
      campaign_description: "#{self.description}",
      track_image_url: track_image
    }
  end

end