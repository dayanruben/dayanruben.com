# Build the small site stylesheet once and reuse it across HTML pages.
# Keep the Sass and vendored Primer files as the canonical sources.
module DayanRuben
  module InlineStyles
    LINK = /<link\b[^>]*\bdata-site-styles="(primer|theme)"[^>]*>/

    def self.apply(site)
      documents = site.pages + site.collections.values.flat_map(&:docs)
      html_documents = documents.select do |document|
        document.output_ext == ".html" && !document.output.to_s.empty?
      end
      return if html_documents.empty?

      theme = site.pages.find { |page| page.url == "/assets/styles.css" }
      if theme.nil? || theme.output.to_s.empty?
        raise Jekyll::Errors::FatalException, "Missing compiled site stylesheet"
      end
      primer_path = File.join(site.source, "assets/vendor/primer.css")
      unless File.file?(primer_path)
        raise Jekyll::Errors::FatalException, "Missing Primer stylesheet"
      end
      css = File.read(primer_path, encoding: "UTF-8") + "\n" + theme.output
      if css.match?(%r{</style}i)
        raise Jekyll::Errors::FatalException, "CSS contains a closing style tag"
      end
      style = "<style id=\"site-styles\">#{css}</style>"

      html_documents.each do |document|
        counts = document.output.scan(LINK).flatten.tally
        %w[primer theme].each do |name|
          unless counts[name] == 1
            raise Jekyll::Errors::FatalException,
                  "Expected exactly one #{name} stylesheet link in #{document.relative_path}"
          end
        end
        document.output = document.output.gsub(LINK) do
          Regexp.last_match(1) == "primer" ? style : ""
        end
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_render do |site|
  DayanRuben::InlineStyles.apply(site)
end
