# Compatibility shims for the legacy github-pages dependency set on modern Ruby.
class Object
  def tainted?
    false
  end unless method_defined?(:tainted?)

  def untaint
    self
  end unless method_defined?(:untaint)
end
